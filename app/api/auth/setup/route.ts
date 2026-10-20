import { env } from "cloudflare:workers";
import { checkOrigin, readBody, authFailure, requestIp } from "@/lib/password-auth";
import { AuthError } from "@/lib/password-auth-service";
import { clientInvitations } from "@/lib/client-invitations";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await readBody(request);
    if (typeof body.token!=="string" || typeof body.password!=="string") throw new AuthError("Enter your new password using the setup link provided.",400);
    if (!env.DB) throw new AuthError("Sign-in storage is unavailable.",503);
    await clientInvitations(env.DB).accept(body.token,body.password,requestIp(request));
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return authFailure(error); }
}
