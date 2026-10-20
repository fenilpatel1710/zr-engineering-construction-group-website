import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isOwner } from "@/lib/auth";
import { checkOrigin, readBody, authFailure } from "@/lib/password-auth";
import { AuthError, normalizeEmail } from "@/lib/password-auth-service";
import { clientInvitations } from "@/lib/client-invitations";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!isOwner(await getChatGPTUser())) throw new AuthError("Not authorized.",403);
    const email = normalizeEmail((await readBody(request)).email);
    if (!email) throw new AuthError("Enter a valid client email address.",400);
    if (!env.DB) throw new AuthError("Sign-in storage is unavailable.",503);
    const token = await clientInvitations(env.DB).create(email);
    return Response.json({path:`/set-password#${token}`},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return authFailure(error); }
}
