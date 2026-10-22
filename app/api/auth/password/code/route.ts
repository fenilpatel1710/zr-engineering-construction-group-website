import { getChatGPTUser } from "@/app/chatgpt-auth";
import { configuredAuth, checkOrigin, authFailure } from "@/lib/password-auth";
import { AuthError } from "@/lib/password-auth-service";
import { companyMail, passwordCodeEmail } from "@/lib/mail";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await getChatGPTUser();
    if (!user) throw new AuthError("Your session has expired. Sign in again.",401);
    const mail = companyMail();
    if (!mail) throw new AuthError("Password changes need email verification, which isn't available yet. Please contact your project manager.",503);
    const code = await configuredAuth().createEmailCode(user.email);
    await mail.send(passwordCodeEmail(user.email,code));
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return authFailure(error); }
}
