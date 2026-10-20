import { env } from "cloudflare:workers";
import { AuthError, passwordAuth } from "./password-auth-service";

export function configuredAuth() {
  if (!env.DB) throw new AuthError("Sign-in is not configured. Please contact the company.",503);
  return passwordAuth(env.DB);
}

export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AuthError("Request not allowed.",403);
  }
}

export async function readBody(request: Request): Promise<Record<string,unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AuthError("JSON required.",415);
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError("Invalid request.",400);
  const chunks: Uint8Array[] = [];
  let length=0;
  while (true) {
    const {done,value}=await reader.read();
    if (done) break;
    length+=value.byteLength;
    if (length>2048) { await reader.cancel(); throw new AuthError("Request too large.",413); }
    chunks.push(value);
  }
  const bytes=new Uint8Array(length);
  let offset=0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength; }
  const text=new TextDecoder().decode(bytes);
  try { const value = JSON.parse(text); if (value && typeof value === "object" && !Array.isArray(value)) return value; } catch {}
  throw new AuthError("Invalid request.",400);
}

export function authFailure(error: unknown) {
  // Never log passwords, session tokens, or submitted credentials.
  return Response.json({error:error instanceof AuthError ? error.message : "Sign-in is temporarily unavailable. Please try again later."},
    {status:error instanceof AuthError ? error.status : 503,headers:{"Cache-Control":"no-store"}});
}
export const requestIp = (request: Request) => request.headers.get("cf-connecting-ip") || "local";
