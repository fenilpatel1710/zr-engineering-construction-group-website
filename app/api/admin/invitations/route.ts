import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isOwner } from "@/lib/auth";
import { checkOrigin, readBody, authFailure } from "@/lib/password-auth";
import { AuthError, normalizeEmail } from "@/lib/password-auth-service";
import { clientInvitations } from "@/lib/client-invitations";
import { companyMail, passwordLinkEmail } from "@/lib/mail";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!isOwner(await getChatGPTUser())) throw new AuthError("Not authorized.",403);
    const body = await readBody(request);
    const email = normalizeEmail(body.email);
    if (!email) throw new AuthError("Enter a valid client email address.",400);
    if (!env.DB) throw new AuthError("Sign-in storage is unavailable.",503);
    const mail = body.send===true ? companyMail() : null;
    if (body.send===true && !mail) throw new AuthError("Email delivery isn't configured yet. Create a link and send it yourself.",503);
    const {token,kind} = await clientInvitations(env.DB).create(email);
    const path = `/set-password#${token}`;
    let sent = false;
    if (mail) {
      // The link is already issued, so return it even if the email fails.
      try { await mail.send(passwordLinkEmail(email,`${new URL(request.url).origin}${path}`,kind)); sent = true; }
      catch (error) { console.error("Password link email failed:",error); }
    }
    return Response.json({path,kind,sent},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return authFailure(error); }
}
