#!/usr/bin/env node
// Produces SQL for a company-approved account; never sends or stores passwords.
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !process.stdin.isTTY) {
  console.error("Run in an interactive terminal: node scripts/create-portal-account.mjs client@example.com [output.sql]");
  process.exit(1);
}
const hidden = new Writable({write(_chunk,_encoding,done){done();}});
const prompt = createInterface({input:process.stdin,output:hidden,terminal:true});
try {
  process.stdout.write("Password (16–256 characters; hidden): ");
  const password = await prompt.question("");
  process.stdout.write("\nConfirm password (hidden): ");
  const confirmation = await prompt.question("");
  process.stdout.write("\n");
  if (password.length<16 || password.length>256 || password!==confirmation) throw new Error("Passwords must match and contain 16–256 characters.");
  const salt = randomBytes(32).toString("hex");
  const hash = pbkdf2Sync(password,salt,100000,32,"sha256").toString("hex");
  const quote = value => "'"+value.replaceAll("'","''")+"'";
  const sql = `INSERT INTO auth_users(email,password_hash,salt) VALUES (${quote(email)},${quote(hash)},${quote(salt)}) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,salt=excluded.salt;\nDELETE FROM auth_sessions WHERE email=${quote(email)};\n`;
  const file = resolve(process.argv[3] || join(tmpdir(),`zr-account-${randomBytes(6).toString("hex")}.sql`));
  writeFileSync(file,sql,{mode:0o600,flag:"wx"});
  console.log(`Account SQL saved to ${file}. Apply it to your D1 database using the setup guide. Treat this hash file as confidential and remove it after use.`);
} catch (error) {
  console.error(error.message);
  process.exitCode=1;
} finally { prompt.close(); }
