import { getChatGPTUser } from "@/app/chatgpt-auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { siteContent } from "@/db/schema";
import { defaultContent } from "@/lib/default-content";
import { isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [row] = await getDb()
      .select({ body: siteContent.body })
      .from(siteContent)
      .where(eq(siteContent.id, "main"))
      .limit(1);
    const saved = row?.body ? JSON.parse(row.body) : {};
    return Response.json(
      { ...defaultContent, ...saved, copy: { ...defaultContent.copy, ...saved.copy } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(defaultContent, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!isOwner(user)) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2_000_000) return Response.json({ error: "Content is too large" }, { status: 413 });
  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!data || typeof data !== "object" || !data.copy || !Array.isArray(data.industries) || !Array.isArray(data.services) || !Array.isArray(data.manuals)) {
    return Response.json({ error: "Missing website content sections" }, { status: 400 });
  }
  if (data.industries.length > 100 || data.services.length > 100 || data.manuals.length > 30) {
    return Response.json({ error: "Too many items" }, { status: 400 });
  }
  try {
    const db = getDb();
    await db.insert(siteContent).values({
      id: "main",
      body: JSON.stringify(data),
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: siteContent.id,
      set: { body: JSON.stringify(data), updatedAt: new Date().toISOString() },
    });
    return Response.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch {
    return Response.json({ error: "Website storage is unavailable. Please try again." }, { status: 503 });
  }
}
