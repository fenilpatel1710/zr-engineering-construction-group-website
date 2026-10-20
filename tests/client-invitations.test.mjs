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
  for (const migration of ["0000_omniscient_gladiator.sql","0001_password_auth.sql","0002_client_invitations.sql"]) sqlite.exec(readFileSync(new URL(`../drizzle/${migration}`,import.meta.url),"utf8"));
  sqlite.prepare("INSERT INTO site_content VALUES ('portal',?,'test')").run(JSON.stringify([{clientEmail:"client@example.com"}]));
  const db={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};},async batch(statements){sqlite.exec("BEGIN");try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};
  let time=1000;
  return {sqlite,db,invites:clientInvitations(db,()=>time),advance(){time+=86401;}};
}
test("saved client receives a hashed, one-use setup token and chooses their password",async()=>{
  const {sqlite,db,invites}=fixture();const token=await invites.create("client@example.com");
  assert.equal(sqlite.prepare("SELECT token_hash FROM auth_invitations").get().token_hash,await digest(token));
  await invites.accept(token,password,"ip");
  assert.ok(await passwordAuth(db).login("client@example.com",password,"ip"));
  assert.equal(sqlite.prepare("SELECT count(*) n FROM auth_invitations").get().n,0);
  await assert.rejects(invites.accept(token,"a different long password","ip"),{status:400});
});
test("unknown clients cannot be invited; existing passwords cannot be overwritten",async()=>{
  const {db,invites}=fixture();await assert.rejects(invites.create("stranger@example.com"),{status:400});
  const token=await invites.create("client@example.com");await invites.accept(token,password,"ip");
  await assert.rejects(invites.create("client@example.com"),{status:409});
  await assert.rejects(invites.accept(token,"replacement long password","ip"),{status:400});
  assert.ok(await passwordAuth(db).login("client@example.com",password,"ip"));
});
test("replacement links invalidate earlier links and expired links fail",async()=>{
  const {invites,advance}=fixture();const first=await invites.create("client@example.com");const second=await invites.create("client@example.com");
  await assert.rejects(invites.accept(first,password,"ip"),{status:400});
  advance();await assert.rejects(invites.accept(second,password,"ip"),{status:400});
});
test("tampered links, short passwords, and removed client assignments fail",async()=>{
  const {invites,sqlite}=fixture();const token=await invites.create("client@example.com");
  await assert.rejects(invites.accept("bad-token",password,"ip"),{status:400});
  await assert.rejects(invites.accept(token,"short","ip"),{status:400});
  sqlite.prepare("UPDATE site_content SET body='[]' WHERE id='portal'").run();
  await assert.rejects(invites.accept(token,password,"ip"),{status:400});
});
test("a setup token cannot reset an account created after invitation issuance",async()=>{
  const {invites,sqlite}=fixture();const token=await invites.create("client@example.com");
  sqlite.prepare("INSERT INTO auth_users VALUES ('client@example.com','original-hash','original-salt')").run();
  await assert.rejects(invites.accept(token,password,"ip"),{status:400});
  assert.equal(sqlite.prepare("SELECT password_hash FROM auth_users").get().password_hash,"original-hash");
});
