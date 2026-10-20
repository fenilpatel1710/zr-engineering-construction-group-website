import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { pbkdf2Sync } from "node:crypto";
import { passwordAuth, passwordHash, normalizeEmail, safeReturn, digest } from "../lib/password-auth-service.ts";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0001_password_auth.sql",import.meta.url),"utf8"));
  const db = {prepare(sql){
    let values=[];
    return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values) || null;},async run(){return sqlite.prepare(sql).run(...values);}};
  },async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
  return {db,sqlite};
}
async function fixture() {
  const {db,sqlite}=database();
  const salt="random-test-salt";const password="a long test password 123";
  sqlite.prepare("INSERT INTO auth_users VALUES (?,?,?)").run("client@example.com",await passwordHash(password,salt),salt);
  return {db,sqlite,password};
}
test("email normalization and redirect allowlist",()=>{
  assert.equal(normalizeEmail(" Client@Example.com "),"client@example.com");
  assert.equal(normalizeEmail("bad\n@example.com"),null);
  assert.equal(safeReturn("https://evil.test"),"/portal");
  assert.equal(safeReturn("//evil.test"),"/portal");
  assert.equal(safeReturn("/admin"),"/admin");
});
test("password hashes match the account provisioning tool",async()=>{
  assert.equal(await passwordHash("example long password","salt"),pbkdf2Sync("example long password","salt",100000,32,"sha256").toString("hex"));
});
test("valid login stores only a token hash and expires after seven days",async()=>{
  const {db,sqlite,password}=await fixture();
  const token=await passwordAuth(db,()=>1000).login("client@example.com",password,"test-ip");
  const session=sqlite.prepare("SELECT * FROM auth_sessions").get();
  assert.equal(session.token_hash,await digest(token));
  assert.equal(session.email,"client@example.com");
  assert.equal(session.expires_at,605800);
  assert.notEqual(session.token_hash,token);
});
test("unknown accounts and wrong passwords never create sessions",async()=>{
  const {db,sqlite}=await fixture();const auth=passwordAuth(db);
  await assert.rejects(auth.login("client@example.com","wrong","ip"),{status:401,message:"Email or password is incorrect."});
  await assert.rejects(auth.login("unknown@example.com","wrong","ip"),{status:401,message:"Email or password is incorrect."});
  assert.equal(sqlite.prepare("SELECT count(*) n FROM auth_sessions").get().n,0);
});
test("per-email throttling survives fresh service instances and resets next window",async()=>{
  const {db,password}=await fixture();let now=0;
  for(let i=0;i<10;i++) await assert.rejects(passwordAuth(db,()=>now).login("client@example.com","wrong",`ip-${i}`),{status:401});
  await assert.rejects(passwordAuth(db,()=>now).login("client@example.com",password,"other-ip"),{status:429});
  now=901;
  assert.ok(await passwordAuth(db,()=>now).login("client@example.com",password,"other-ip"));
});
test("IP throttling spans different email addresses",async()=>{
  const {db}=await fixture();const auth=passwordAuth(db);
  for(let i=0;i<30;i++) await assert.rejects(auth.login(`unknown${i}@example.com`,"wrong","same-ip"),{status:401});
  await assert.rejects(auth.login("different@example.com","wrong","same-ip"),{status:429});
});
