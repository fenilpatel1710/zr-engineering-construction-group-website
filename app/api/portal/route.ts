import { normalizeEmail } from "@/lib/password-auth-service";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { siteContent } from "@/db/schema";
import { isOwner } from "@/lib/auth";
import { validPortalProjects } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function readProjects() {
  const [row] = await getDb().select({ body: siteContent.body }).from(siteContent).where(eq(siteContent.id, "portal")).limit(1);
  const parsed = row?.body ? JSON.parse(row.body) : [];
  return validPortalProjects(parsed) ? parsed : [];
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const projects = await readProjects();
    const visible = isOwner(user)
      ? projects
      : projects.filter((p) => normalizeEmail(p.clientEmail) === user.email);
    return Response.json({ projects: visible, owner: isOwner(user) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Portal data is unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!isOwner(user)) return Response.json({ error: "Not authorized" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const projects = body && typeof body === "object" ? (body as { projects?: unknown }).projects : undefined;
  if (!validPortalProjects(projects)) return Response.json({ error: "Check the project, invoice, client email and secure link fields." }, { status: 400 });
  try {
    const db = getDb();
    await db.insert(siteContent).values({ id: "portal", body: JSON.stringify(projects), updatedAt: new Date().toISOString() }).onConflictDoUpdate({
      target: siteContent.id, set: { body: JSON.stringify(projects), updatedAt: new Date().toISOString() },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Portal storage is unavailable" }, { status: 503 });
  }
}
