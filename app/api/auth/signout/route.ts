import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { checkOrigin, authFailure } from "@/lib/password-auth";
import { digest, SESSION_COOKIE } from "@/lib/password-auth-service";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token && env.DB) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await digest(token)).run();
    return new Response(null,{status:303,headers:{Location:"/website.html","Cache-Control":"no-store","Set-Cookie":`${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}});
  } catch (error) { return authFailure(error); }
}
