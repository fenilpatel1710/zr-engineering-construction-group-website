import { AuthError, digest, normalizeEmail, passwordHash } from "./password-auth-service";

export type InvitationKind = "setup" | "reset";
const INVALID = "This link is invalid or expired. Request a new one from the sign-in page or ask your project manager.";

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

async function hasAccount(db: D1Database, email: string) {
  return Boolean(await db.prepare("SELECT email FROM auth_users WHERE email=?").bind(email).first());
}

// `owners` may set a first password by email even without an assigned project.
export function clientInvitations(db: D1Database, now = () => Math.floor(Date.now()/1000), owners: readonly string[] = []) {
  const eligible = async (email: string) => owners.includes(email) || await assignedClient(db,email);
  // A setup link can only create an account; a reset link can only change an
  // existing one. The kind is fixed when the link is issued.
  async function issue(email: string) {
    const kind: InvitationKind = await hasAccount(db,email) ? "reset" : "setup";
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    await db.batch([
      db.prepare("DELETE FROM auth_invitations WHERE expires_at<=?").bind(now()),
      db.prepare("INSERT INTO auth_invitations (email,token_hash,expires_at,kind) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,kind=excluded.kind").bind(email,await digest(token),now()+86400,kind),
    ]);
    return {token,kind};
  }
  return {
    // Owner-issued link for a client saved on a project.
    async create(email: string) {
      if (!await assignedClient(db,email)) throw new AuthError("Save a project with this client email before creating a setup link.",400);
      await limit(db,"invite-create",now(),100);
      return issue(email);
    },
    // Self-service "forgot password". Returns null for unknown emails so callers
    // can respond identically either way.
    async request(email: string, ip: string) {
      await limit(db,`invite-request-ip:${await digest(ip)}`,now(),10);
      await limit(db,`invite-request-email:${await digest(email)}`,now(),3);
      if (!await hasAccount(db,email) && !await eligible(email)) return null;
      return issue(email);
    },
    async accept(token: string, password: string, ip: string) {
      if (!/^[a-f0-9-]{72}$/.test(token)) throw new AuthError(INVALID,400);
      if (password.length<16 || password.length>256) throw new AuthError("Choose a password between 16 and 256 characters.",400);
      await limit(db,`invite-accept:${await digest(ip)}`,now(),30);
      const tokenHash = await digest(token);
      const invite = await db.prepare("SELECT email,kind FROM auth_invitations WHERE token_hash=? AND expires_at>?").bind(tokenHash,now()).first<{email:string;kind:InvitationKind}>();
      if (!invite || (invite.kind==="setup" && !await eligible(invite.email))) throw new AuthError(INVALID,400);
      const salt = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const hash = await passwordHash(password,salt);
      // D1 batches are transactional, so each link can be redeemed only once.
      if (invite.kind==="reset") {
        const live = "SELECT email FROM auth_invitations WHERE token_hash=? AND expires_at>? AND kind='reset'";
        const results = await db.batch([
          db.prepare(`DELETE FROM auth_sessions WHERE email=(${live})`).bind(tokenHash,now()),
          db.prepare(`UPDATE auth_users SET password_hash=?,salt=? WHERE email=(${live})`).bind(hash,salt,tokenHash,now()),
          db.prepare("DELETE FROM auth_invitations WHERE token_hash=?").bind(tokenHash),
        ]);
        if (results[1].meta.changes!==1) throw new AuthError(INVALID,400);
        return;
      }
      const results = await db.batch([
        db.prepare("INSERT INTO auth_users (email,password_hash,salt) SELECT email,?,? FROM auth_invitations WHERE token_hash=? AND expires_at>? AND kind='setup' ON CONFLICT(email) DO NOTHING").bind(hash,salt,tokenHash,now()),
        db.prepare("DELETE FROM auth_invitations WHERE token_hash=? AND EXISTS (SELECT 1 FROM auth_users WHERE email=auth_invitations.email)").bind(tokenHash),
      ]);
      if (results[0].meta.changes!==1) throw new AuthError("This setup link has already been used or expired. Sign in or request a password reset from the sign-in page.",400);
    },
  };
}
