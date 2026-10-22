import { env } from "cloudflare:workers";
import { checkOrigin, readBody, authFailure, requestIp } from "@/lib/password-auth";
import { AuthError, normalizeEmail } from "@/lib/password-auth-service";
import { clientInvitations } from "@/lib/client-invitations";
import { companyMail, passwordLinkEmail } from "@/lib/mail";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const email = normalizeEmail((await readBody(request)).email);
    if (!email) throw new AuthError("Enter a valid email address.",400);
    const mail = companyMail();
    if (!mail) throw new AuthError("Password reset by email isn't available yet. Please contact your project manager.",503);
    if (!env.DB) throw new AuthError("Sign-in storage is unavailable.",503);
    const issued = await clientInvitations(env.DB).request(email,requestIp(request));
    // Same response whether or not the email has an account.
    if (issued) await mail.send(passwordLinkEmail(email,`${new URL(request.url).origin}/set-password#${issued.token}`,issued.kind));
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return authFailure(error); }
}
