// Compatibility exports for existing portal/editor consumers. Identity now comes
// only from database sessions, never caller-supplied authentication headers.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import { digest, SESSION_COOKIE, safeReturn } from "@/lib/password-auth-service";

export type ChatGPTUser = {userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100 || !env.DB) return null;
  const session = await env.DB.prepare("SELECT s.email FROM auth_sessions s JOIN auth_users u ON u.email=s.email WHERE s.token_hash=? AND s.expires_at>?")
    .bind(await digest(token),Math.floor(Date.now()/1000)).first<{email:string}>();
  return session ? {userId:`email:${session.email}`,displayName:session.email,email:session.email,fullName:null} : null;
}
export async function requireChatGPTUser(returnTo:string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo:string) { return `/signin?return_to=${encodeURIComponent(safeReturn(returnTo))}`; }
export function chatGPTSignOutPath() { return "/signout"; }
