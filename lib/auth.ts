// The editor is restricted to the verified Site owner accounts.
export const OWNER_USER_ID = "501f1659-7a20-4e7e-a614-c4ed4bdbe2c0";
export const OWNER_EMAILS: readonly string[] = ["fenil845@gmail.com", "charlie@zrgrouptx.com"];

export function isOwner(user: { userId: string; email: string } | null | undefined) {
  return Boolean(user && (user.userId === OWNER_USER_ID || OWNER_EMAILS.includes(user.email.trim().toLowerCase())));
}
