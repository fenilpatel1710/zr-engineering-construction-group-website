export const SESSION_COOKIE = "__Host-zr_session";
const encoder = new TextEncoder();

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function safeReturn(value: unknown): string {
  return value === "/admin" ? "/admin" : "/portal";
}

export async function digest(value: string): Promise<string> {
  return Buffer.from(await crypto.subtle.digest("SHA-256", encoder.encode(value))).toString("hex");
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status=status; }
}

export async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
  // Workers Web Crypto supports at most 100,000 iterations. Passwords must be 16+ characters.
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:encoder.encode(salt),iterations:100000},key,256);
  return Buffer.from(bits).toString("hex");
}

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i=0;i<a.length;i++) difference |= a.charCodeAt(i)^b.charCodeAt(i);
  return difference === 0;
}

export function passwordAuth(db: D1Database, now = () => Math.floor(Date.now()/1000)) {
  async function limit(key: string, seconds: number, maximum: number) {
    const time = now();
    const row = await db.prepare("INSERT INTO auth_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count")
      .bind(`${key}:${Math.floor(time/seconds)}`,time+seconds*2).first<{count:number}>();
    if (!row || row.count>maximum) throw new AuthError("Too many attempts. Please try again later.",429);
  }
  return {
    async login(email: string, password: string, ip: string) {
      await limit(`login-ip:${await digest(ip)}`,900,30);
      await limit(`login-email:${await digest(email)}`,900,10);
      const user = await db.prepare("SELECT email,password_hash,salt FROM auth_users WHERE email=?").bind(email).first<{email:string;password_hash:string;salt:string}>();
      // Perform the same expensive operation for an unknown account.
      const hash = await passwordHash(password,user?.salt || "zr-unknown-account-dummy-salt");
      if (!user || !equal(hash,user.password_hash)) throw new AuthError("Email or password is incorrect.",401);
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      await db.batch([
        db.prepare("DELETE FROM auth_sessions WHERE expires_at < ?").bind(now()),
        db.prepare("DELETE FROM auth_rate_limits WHERE expires_at < ?").bind(now()),
        db.prepare("INSERT INTO auth_sessions (token_hash,email,expires_at) VALUES (?,?,?)").bind(await digest(token),user.email,now()+604800),
      ]);
      return token;
    },
  };
}
