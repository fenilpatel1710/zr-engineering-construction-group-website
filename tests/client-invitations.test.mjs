import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,next){
  try {return next(specifier,context);} catch(error) {
    if (error.code==="ERR_MODULE_NOT_FOUND" && specifier.startsWith(".")) return next(specifier+".ts",context);
    throw error;
  }
}});
const {clientInvitations}=await import("../lib/client-invitations.ts");
const {passwordAuth,digest}=await import("../lib/password-auth-service.ts");
const password="client chooses a long password";
function fixture() {
  const sqlite=new DatabaseSync(":memory:");
  for (const migration of ["0000_omniscient_gladiator.sql","0001_password_auth.sql","0002_client_invitations.sql","0003_invitation_kind.sql"]) sqlite.exec(readFileSync(new URL(`../drizzle/${migration}`,import.meta.url),"utf8"));
  sqlite.prepare("INSERT INTO site_content VALUES ('portal',?,'test')").run(JSON.stringify([{clientEmail:"client@example.com"}]));
  const db={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};},async batch(statements){sqlite.exec("BEGIN");try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};
  let time=1000;
  return {sqlite,db,invites:clientInvitations(db,()=>time),advance(){time+=86401;}};
}
test("saved client receives a hashed, one-use setup token and chooses their password",async()=>{
  const {sqlite,db,invites}=fixture();const {token,kind}=await invites.create("client@example.com");
  assert.equal(kind,"setup");
  assert.equal(sqlite.prepare("SELECT token_hash FROM auth_invitations").get().token_hash,await digest(token));
  await invites.accept(token,password,"ip");
  assert.ok(await passwordAuth(db).login("client@example.com",password,"ip"));
  assert.equal(sqlite.prepare("SELECT count(*) n FROM auth_invitations").get().n,0);
  await assert.rejects(invites.accept(token,"a different long password","ip"),{status:400});
});
test("unknown clients cannot be invited; a used setup link cannot overwrite the password",async()=>{
  const {db,invites}=fixture();await assert.rejects(invites.create("stranger@example.com"),{status:400});
  const {token}=await invites.create("client@example.com");await invites.accept(token,password,"ip");
  await assert.rejects(invites.accept(token,"replacement long password","ip"),{status:400});
  assert.ok(await passwordAuth(db).login("client@example.com",password,"ip"));
});
test("existing accounts get a one-use reset link that signs out old sessions",async()=>{
  const {sqlite,db,invites}=fixture();await invites.accept((await invites.create("client@example.com")).token,password,"ip");
  await passwordAuth(db).login("client@example.com",password,"ip");
  const {token,kind}=await invites.create("client@example.com");assert.equal(kind,"reset");
  await invites.accept(token,"a brand new long password","ip");
  assert.equal(sqlite.prepare("SELECT count(*) n FROM auth_sessions").get().n,0);
  await assert.rejects(passwordAuth(db).login("client@example.com",password,"ip"),{status:401});
  assert.ok(await passwordAuth(db).login("client@example.com","a brand new long password","ip"));
  await assert.rejects(invites.accept(token,"yet another long password","ip"),{status:400});
});
test("self-service requests issue links only for known emails and are rate limited",async()=>{
  const {sqlite,invites}=fixture();
  assert.equal(await invites.request("stranger@example.com","ip"),null);
  assert.equal((await invites.request("client@example.com","ip")).kind,"setup");
  // The owner has an account but no assigned project.
  sqlite.prepare("INSERT INTO auth_users VALUES ('owner@example.com','h','s')").run();
  assert.equal((await invites.request("owner@example.com","ip")).kind,"reset");
  await invites.request("client@example.com","ip");await invites.request("client@example.com","ip");
  await assert.rejects(invites.request("client@example.com","ip"),{status:429});
});
test("owner emails can set a first password by email without an assigned project",async()=>{
  const {db}=fixture();let time=1000;
  assert.equal(await clientInvitations(db,()=>time).request("admin@example.com","ip"),null);
  const owners=clientInvitations(db,()=>time,["admin@example.com"]);
  const {token,kind}=await owners.request("admin@example.com","ip");assert.equal(kind,"setup");
  await assert.rejects(clientInvitations(db,()=>time).accept(token,password,"ip"),{status:400});
  await owners.accept(token,password,"ip");
  assert.ok(await passwordAuth(db).login("admin@example.com",password,"ip"));
});
test("changing password needs the current password and emailed code, and keeps only the current session",async()=>{
  const {sqlite,db,invites}=fixture();await invites.accept((await invites.create("client@example.com")).token,password,"ip");
  const auth=passwordAuth(db);const current=await auth.login("client@example.com",password,"ip");await auth.login("client@example.com",password,"ip");
  const next="a brand new long password";
  await assert.rejects(auth.changePassword("client@example.com",password,next,"123456",current),{status:400});
  const code=await auth.createEmailCode("client@example.com");assert.match(code,/^\d{6}$/);
  assert.notEqual(sqlite.prepare("SELECT code_hash FROM auth_email_codes").get().code_hash,code);
  await assert.rejects(auth.changePassword("client@example.com","wrong password here",next,code,current),{status:400});
  await assert.rejects(auth.changePassword("client@example.com",password,"short",code,current),{status:400});
  await auth.changePassword("client@example.com",password,next,code,current);
  assert.deepEqual(sqlite.prepare("SELECT token_hash FROM auth_sessions").all().map(r=>r.token_hash),[await digest(current)]);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM auth_email_codes").get().n,0);
  assert.ok(await auth.login("client@example.com",next,"ip"));
  await assert.rejects(auth.changePassword("client@example.com",next,"another long password!!",code,current),{status:400});
});
test("emailed codes lock after 5 wrong tries and expire after 10 minutes",async()=>{
  const {db,invites}=fixture();await invites.accept((await invites.create("client@example.com")).token,password,"ip");
  let time=5000;const auth=passwordAuth(db,()=>time);const next="a brand new long password";
  const code=await auth.createEmailCode("client@example.com");const wrong=code==="000000"?"111111":"000000";
  for (let i=0;i<5;i++) await assert.rejects(auth.changePassword("client@example.com",password,next,wrong,"s"),{message:"That code is incorrect."});
  await assert.rejects(auth.changePassword("client@example.com",password,next,code,"s"),{message:/expired/});
  const fresh=await auth.createEmailCode("client@example.com");time+=601;
  await assert.rejects(auth.changePassword("client@example.com",password,next,fresh,"s"),{message:/expired/});
});
test("replacement links invalidate earlier links and expired links fail",async()=>{
  const {invites,advance}=fixture();const first=(await invites.create("client@example.com")).token;const second=(await invites.create("client@example.com")).token;
  await assert.rejects(invites.accept(first,password,"ip"),{status:400});
  advance();await assert.rejects(invites.accept(second,password,"ip"),{status:400});
});
test("tampered links, short passwords, and removed client assignments fail",async()=>{
  const {invites,sqlite}=fixture();const {token}=await invites.create("client@example.com");
  await assert.rejects(invites.accept("bad-token",password,"ip"),{status:400});
  await assert.rejects(invites.accept(token,"short","ip"),{status:400});
  sqlite.prepare("UPDATE site_content SET body='[]' WHERE id='portal'").run();
  await assert.rejects(invites.accept(token,password,"ip"),{status:400});
});
test("a setup token cannot reset an account created after invitation issuance",async()=>{
  const {invites,sqlite}=fixture();const {token}=await invites.create("client@example.com");
  sqlite.prepare("INSERT INTO auth_users VALUES ('client@example.com','original-hash','original-salt')").run();
  await assert.rejects(invites.accept(token,password,"ip"),{status:400});
  assert.equal(sqlite.prepare("SELECT password_hash FROM auth_users").get().password_hash,"original-hash");
});
