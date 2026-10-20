// Run after pnpm build. Uses disposable local D1/R2 state, never remote resources.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, openSync, closeSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, pbkdf2Sync } from "node:crypto";
const root=resolve(import.meta.dirname,"..");
const work=mkdtempSync(join(root,".sites-runtime/auth-integration-"));
const state=join(work,"state");
const wrangler=resolve(root,"node_modules/wrangler/bin/wrangler.js");
const config=JSON.parse(readFileSync(resolve(root,"dist/server/wrangler.json"),"utf8"));
config.d1_databases.forEach(db=>db.migrations_dir=resolve(root,"drizzle"));
const dbConfig=join(work,"database.json");
writeFileSync(dbConfig,JSON.stringify({name:"auth-test",compatibility_date:"2026-05-15",d1_databases:config.d1_databases}));
const runtimeEnv={...process.env,SITES_RUNTIME_ROOT:work,WRANGLER_REGISTRY_PATH:join(work,"dev-registry"),MINIFLARE_REGISTRY_PATH:join(work,"registry"),XDG_CONFIG_HOME:join(work,"config"),CI:"true",WRANGLER_SEND_METRICS:"false",CLOUDFLARE_CF_FETCH_ENABLED:"false"};
function cli(args) {
  const result=spawnSync(process.execPath,["--import","./scripts/sites-env.mjs",wrangler,...args],{cwd:root,env:runtimeEnv,encoding:"utf8"});
  if(result.status!==0) throw new Error(result.stderr+result.stdout);
}
const quote=value=>"'"+value.replaceAll("'","''")+"'";
let worker;
const logFd=openSync(join(work,"worker.log"),"w");
try {
  cli(["d1","migrations","apply","DB","--local","--config",dbConfig,"--persist-to",state]);
  const password=randomBytes(24).toString("hex");
  const salt=randomBytes(32).toString("hex");
  const hash=pbkdf2Sync(password,salt,100000,32,"sha256").toString("hex");
  const projects=[{id:"a",title:"Client A",clientEmail:"client-a@example.com",clientName:"A",invoices:[],photos:["/api/media/portal/photos/a.jpg"]},{id:"b",title:"Client B",clientEmail:"client-b@example.com",clientName:"B",invoices:[],photos:["/api/media/portal/photos/b.jpg"]}];
  const fixture=join(work,"fixture.sql");
  writeFileSync(fixture,`INSERT INTO auth_users VALUES ('client-a@example.com',${quote(hash)},${quote(salt)});\nINSERT INTO auth_users VALUES ('fenil845@gmail.com',${quote(hash)},${quote(salt)});\nINSERT INTO site_content VALUES ('portal',${quote(JSON.stringify(projects))},'test');`,{mode:0o600});
  cli(["d1","execute","DB","--local","--config",dbConfig,"--persist-to",state,"--file",fixture]);
  // Disable file watching and service discovery for this fixed build. Otherwise
  // the development proxy can restart mid-POST while registering local services.
  const startWorker = `import {unstable_startWorker} from "wrangler";
const worker=await unstable_startWorker({config:"dist/server/wrangler.json",dev:{remote:false,persist:process.argv[1],watch:false,inspector:false,logLevel:"warn",server:{hostname:"127.0.0.1",port:8793}}});
await worker.ready;
process.on("SIGTERM",()=>worker.dispose().then(()=>process.exit(0)));`;
  worker=spawn(process.execPath,["--import","./scripts/sites-env.mjs","--input-type=module","-e",startWorker,state],{cwd:root,env:runtimeEnv,stdio:["ignore",logFd,logFd]});
  const base="http://127.0.0.1:8793";
  let ready=false;
  for(let i=0;i<80;i++) { try { if((await fetch(base+"/signin")).status===200) {ready=true;break;} } catch {} await new Promise(r=>setTimeout(r,250)); }
  assert.ok(ready,"Worker ready");
  const post=async(path,body,options={})=>{
    const send=()=>fetch(base+path,{method:"POST",redirect:"manual",headers:{Origin:base,"Content-Type":"application/json",...options.headers},body:JSON.stringify(body)});
    const response=await send();
    // Wrangler's development proxy can switch local upstreams after startup.
    // Retry only its explicit restart response, never application failures.
    if (response.status===503 && (await response.clone().text())==="Your worker restarted mid-request. Please try sending the request again. Only GET or HEAD requests are retried automatically.") {
      console.log("Local Wrangler proxy restarted; retrying this test request once.");
      await new Promise(resolve=>setTimeout(resolve,250));
      return send();
    }
    return response;
  };
  const legacy=await fetch(base+"/signin-with-chatgpt?return_to=%2Fportal",{redirect:"manual"});
  assert.equal(legacy.status,302);assert.equal(legacy.headers.get("location"),"/signin?return_to=%2Fportal");
  assert.equal((await post("/api/auth/login",{email:"a".repeat(3000)})).status,413);
  const malformed=await fetch(base+"/api/auth/login",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:"{"});
  assert.equal(malformed.status,400);
  const anonymous=await fetch(base+"/portal",{redirect:"manual"});
  assert.equal(anonymous.status,307);assert.match(anonymous.headers.get("location"),/^\/signin\?/);
  assert.equal((await fetch(base+"/api/portal",{headers:{"oai-authenticated-user-id":"spoof","oai-authenticated-user-email":"fenil845@gmail.com"}})).status,401);
  assert.equal((await post("/api/auth/login",{email:"client-a@example.com",password},{headers:{Origin:"https://other.example"}})).status,403);
  assert.equal((await post("/api/auth/login",{email:"client-a@example.com",password:"wrong"})).status,401);
  const login=await post("/api/auth/login",{email:" CLIENT-A@EXAMPLE.COM ",password,returnTo:"https://evil.example"});
  assert.equal(login.status,200);assert.equal((await login.json()).redirect,"/portal");
  const cookie=login.headers.get("set-cookie");
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);
  const headers={Cookie:cookie.split(";")[0]};
  const portal=await fetch(base+"/api/portal",{headers});assert.equal(portal.status,200);
  assert.deepEqual((await portal.json()).projects.map(p=>p.id),["a"]);
  assert.equal((await fetch(base+"/portal",{headers})).status,200);
  assert.equal((await fetch(base+"/api/media/portal/photos/b.jpg",{headers})).status,404);
  assert.equal((await post("/api/portal",{projects:[]},{headers})).status,405);
  const denied=await fetch(base+"/api/portal",{method:"PUT",headers:{...headers,"Content-Type":"application/json"},body:'{"projects":[]}'});
  assert.equal(denied.status,403);
  assert.equal((await post("/api/admin/invitations",{email:"client-b@example.com"})).status,403);
  assert.equal((await post("/api/admin/invitations",{email:"client-b@example.com"},{headers})).status,403);
  const ownerLogin=await post("/api/auth/login",{email:"fenil845@gmail.com",password,returnTo:"/admin"});
  assert.equal(ownerLogin.status,200);
  const ownerHeaders={Cookie:ownerLogin.headers.get("set-cookie").split(";")[0]};
  assert.equal((await fetch(base+"/admin",{headers:ownerHeaders})).status,200);
  const invitation=await post("/api/admin/invitations",{email:"client-b@example.com"},{headers:ownerHeaders});
  assert.equal(invitation.status,200);
  const invitationPath=(await invitation.json()).path;
  assert.match(invitationPath,/^\/set-password#[a-f0-9-]{72}$/);
  assert.equal((await fetch(base+"/set-password")).status,200);
  const token=invitationPath.split("#")[1];
  const chosenPassword=randomBytes(24).toString("hex");
  assert.equal((await post("/api/auth/setup",{token,password:chosenPassword},{headers:{Origin:"https://other.example"}})).status,403);
  assert.equal((await post("/api/auth/setup",{token,password:chosenPassword})).status,200);
  assert.equal((await post("/api/auth/setup",{token,password:chosenPassword})).status,400);
  const clientBLogin=await post("/api/auth/login",{email:"client-b@example.com",password:chosenPassword});
  assert.equal(clientBLogin.status,200);
  const clientBHeaders={Cookie:clientBLogin.headers.get("set-cookie").split(";")[0]};
  const clientBPortal=await fetch(base+"/api/portal",{headers:clientBHeaders});
  assert.deepEqual((await clientBPortal.json()).projects.map(p=>p.id),["b"]);
  assert.equal((await post("/api/admin/invitations",{email:"client-b@example.com"},{headers:ownerHeaders})).status,409);
  assert.equal((await post("/api/auth/signout",{},{headers})).status,303);
  assert.equal((await fetch(base+"/api/portal",{headers})).status,401);
  console.log("PASS: owner invitation issuance, client password setup, one-use redemption, client isolation, live Worker login, redirect safety, spoofed headers, CSRF, secure cookies, portal rendering, client isolation, owner-only writes, private media and sign-out revocation");
} catch(error) {
  console.error(readFileSync(join(work,"worker.log"),"utf8"));throw error;
} finally {
  if(worker && worker.exitCode === null) {worker.kill("SIGTERM");await new Promise(r=>worker.once("exit",r));}
  closeSync(logFd);rmSync(work,{recursive:true,force:true});
}
