import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { siteContent } from "@/db/schema";
import { isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!env.BUCKET) return new Response("File storage is unavailable", { status: 503 });
  const { key: parts } = await params;
  const key = parts.join("/");
  const portalFile = key.startsWith("portal/photos/") || key.startsWith("portal/documents/");
  if (!portalFile && !key.startsWith("photos/") && !key.startsWith("manuals/")) return new Response("Not found", { status: 404 });
  if (portalFile) {
    const user = await getChatGPTUser();
    if (!user) return new Response("Sign in required", { status: 401 });
    if (!isOwner(user)) {
      const [row] = await getDb().select({ body: siteContent.body }).from(siteContent).where(eq(siteContent.id, "portal")).limit(1);
      let projects: Array<{ clientEmail?: string; photos?: string[]; documents?: { url: string }[]; invoices?: { invoiceUrl?: string }[] }> = [];
      try { projects = row?.body ? JSON.parse(row.body) : []; } catch { projects = []; }
      const fileUrl = `/api/media/${key}`;
      const authorized = projects.some((p) => p.clientEmail?.toLowerCase() === user.email.toLowerCase() &&
        ([...(p.photos || []), ...(p.documents || []).map(d => d.url), ...(p.invoices || []).map(i => i.invoiceUrl || "")].includes(fileUrl)));
      if (!authorized) return new Response("Not found", { status: 404 });
    }
  }
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", portalFile ? "private, no-store" : "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
