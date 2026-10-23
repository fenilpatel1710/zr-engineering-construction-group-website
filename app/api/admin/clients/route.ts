import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isOwner } from "@/lib/auth";
import { checkOrigin, readBody, authFailure } from "@/lib/password-auth";
import { AuthError, normalizeEmail } from "@/lib/password-auth-service";
import { clientAccounts } from "@/lib/client-accounts";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!isOwner(await getChatGPTUser())) throw new AuthError("Not authorized.",403);
    const body = await readBody(request);
    const email = normalizeEmail(body.email);
    if (!email) throw new AuthError("Enter a valid client email address.",400);
    if (!env.DB) throw new AuthError("Sign-in storage is unavailable.",503);
    const accounts = clientAccounts(env.DB);
    if (body.action==="unlock") await accounts.unlock(email);
    else if (body.action!=="status") throw new AuthError("Unknown action.",400);
    return Response.json(await accounts.status(email),{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return authFailure(error); }
}
