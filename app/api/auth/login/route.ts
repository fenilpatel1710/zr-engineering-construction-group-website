import { configuredAuth, checkOrigin, readBody, authFailure, requestIp } from "@/lib/password-auth";
import { AuthError, SESSION_COOKIE, safeReturn, normalizeEmail } from "@/lib/password-auth-service";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await readBody(request);
    const email = normalizeEmail(body.email);
    if (!email || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256) throw new AuthError("Enter your email and password.",400);
    const token = await configuredAuth().login(email,body.password,requestIp(request));
    return Response.json({redirect:safeReturn(body.returnTo)},{headers:{"Cache-Control":"no-store","Set-Cookie":`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`}});
  } catch (error) { return authFailure(error); }
}
