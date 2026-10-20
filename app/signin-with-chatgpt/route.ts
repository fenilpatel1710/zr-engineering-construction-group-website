import { safeReturn } from "@/lib/password-auth-service";
export function GET(request: Request) {
  const target = safeReturn(new URL(request.url).searchParams.get("return_to"));
  return new Response(null,{status:302,headers:{Location:`/signin?return_to=${encodeURIComponent(target)}`,"Cache-Control":"no-store"}});
}
