import { AuthError, digest, normalizeEmail, passwordHash } from "./password-auth-service";

async function limit(db: D1Database, key: string, now: number, maximum: number) {
  const row = await db.prepare("INSERT INTO auth_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count")
    .bind(`${key}:${Math.floor(now/3600)}`,now+7200).first<{count:number}>();
  if (!row || row.count>maximum) throw new AuthError("Too many attempts. Please try again later.",429);
}

async function assignedClient(db: D1Database, email: string) {
  const row = await db.prepare("SELECT body FROM site_content WHERE id='portal'").first<{body:string}>();
  const projects: unknown = row ? JSON.parse(row.body) : [];
  return Array.isArray(projects) && projects.some(p=>p && normalizeEmail(p.clientEmail)===email);
}

export function clientInvitations(db: D1Database, now = () => Math.floor(Date.now()/1000)) {
  return {
    async create(email: string) {
      if (!await assignedClient(db,email)) throw new AuthError("Save a project with this client email before creating a setup link.",400);
      if (await db.prepare("SELECT email FROM auth_users WHERE email=?").bind(email).first()) throw new AuthError("This client already has an account. They can sign in with their existing password.",409);
      await limit(db,"invite-create",now(),100);
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      await db.batch([
        db.prepare("DELETE FROM auth_invitations WHERE expires_at<=?").bind(now()),
        db.prepare("INSERT INTO auth_invitations (email,token_hash,expires_at) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at").bind(email,await digest(token),now()+86400),
      ]);
      return token;
    },
    async accept(token: string, password: string, ip: string) {
      if (!/^[a-f0-9-]{72}$/.test(token)) throw new AuthError("This setup link is invalid or expired. Ask your project manager for a new link.",400);
      if (password.length<16 || password.length>256) throw new AuthError("Choose a password between 16 and 256 characters.",400);
      await limit(db,`invite-accept:${await digest(ip)}`,now(),30);
      const tokenHash = await digest(token);
      const invite = await db.prepare("SELECT email FROM auth_invitations WHERE token_hash=? AND expires_at>?").bind(tokenHash,now()).first<{email:string}>();
      if (!invite || !await assignedClient(db,invite.email)) throw new AuthError("This setup link is invalid or expired. Ask your project manager for a new link.",400);
      const salt = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const hash = await passwordHash(password,salt);
      // D1 batches are transactional: only the first redemption can create an
      // account. A setup link can never overwrite an existing password.
      const results = await db.batch([
        db.prepare("INSERT INTO auth_users (email,password_hash,salt) SELECT email,?,? FROM auth_invitations WHERE token_hash=? AND expires_at>? ON CONFLICT(email) DO NOTHING").bind(hash,salt,tokenHash,now()),
        db.prepare("DELETE FROM auth_invitations WHERE token_hash=? AND EXISTS (SELECT 1 FROM auth_users WHERE email=auth_invitations.email)").bind(tokenHash),
      ]);
      if (results[0].meta.changes!==1) throw new AuthError("This setup link has already been used or expired. Sign in or ask your project manager for help.",400);
    },
  };
}
