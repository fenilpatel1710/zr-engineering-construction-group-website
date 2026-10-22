import { cookies } from "next/headers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { configuredAuth, checkOrigin, readBody, authFailure } from "@/lib/password-auth";
import { AuthError, SESSION_COOKIE } from "@/lib/password-auth-service";
import { companyMail } from "@/lib/mail";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await getChatGPTUser();
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!user || !token) throw new AuthError("Your session has expired. Sign in again.",401);
    if (!companyMail()) throw new AuthError("Password changes need email verification, which isn't available yet. Please contact your project manager.",503);
    const body = await readBody(request);
    if (typeof body.current!=="string" || typeof body.password!=="string" || typeof body.code!=="string" || body.current.length>256) throw new AuthError("Enter your current password, new password and emailed code.",400);
    await configuredAuth().changePassword(user.email,body.current,body.password,body.code.trim(),token);
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return authFailure(error); }
}
