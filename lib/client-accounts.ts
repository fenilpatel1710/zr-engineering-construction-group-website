import { digest } from "./password-auth-service";

// Rate-limit key prefixes tied to one email (see password-auth-service and client-invitations).
const EMAIL_LIMITS = ["login-email", "password-change", "email-code", "invite-request-email"];

export type ClientAccountStatus = {
  hasAccount: boolean;
  pendingLink: { kind: "setup" | "reset"; expiresAt: number } | null;
  locked: boolean;
};

export function clientAccounts(db: D1Database, now = () => Math.floor(Date.now()/1000)) {
  return {
    async status(email: string): Promise<ClientAccountStatus> {
      const hashed = await digest(email);
      const [user, invite, lock] = await Promise.all([
        db.prepare("SELECT email FROM auth_users WHERE email=?").bind(email).first(),
        db.prepare("SELECT kind,expires_at FROM auth_invitations WHERE email=? AND expires_at>?").bind(email,now()).first<{kind:"setup"|"reset";expires_at:number}>(),
        // Login allows 10 attempts per email per 15-minute window.
        db.prepare("SELECT count FROM auth_rate_limits WHERE key=?").bind(`login-email:${hashed}:${Math.floor(now()/900)}`).first<{count:number}>(),
      ]);
      return {
        hasAccount: Boolean(user),
        pendingLink: invite ? { kind: invite.kind, expiresAt: invite.expires_at } : null,
        locked: Boolean(lock && lock.count >= 10),
      };
    },
    // Clears every attempt limit for this email, so the client can sign in or request a reset now.
    async unlock(email: string) {
      const hashed = await digest(email);
      await db.batch(EMAIL_LIMITS.map(prefix => db.prepare("DELETE FROM auth_rate_limits WHERE key LIKE ?").bind(`${prefix}:${hashed}:%`)));
    },
  };
}
