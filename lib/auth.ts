// The editor is restricted to the verified Site owner account.
export const OWNER_USER_ID = "501f1659-7a20-4e7e-a614-c4ed4bdbe2c0";
export const OWNER_EMAIL = "fenil845@gmail.com";

export function isOwner(user: { userId: string; email: string } | null | undefined) {
  return Boolean(user && (user.userId === OWNER_USER_ID || user.email.trim().toLowerCase() === OWNER_EMAIL));
}
