import { normalizeEmail } from "@/lib/password-auth-service";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isOwner, OWNER_EMAILS } from "@/lib/auth";
import { validPortalProjects, type PortalProject } from "@/lib/portal";
import { env } from "cloudflare:workers";
import { clientInvitations } from "@/lib/client-invitations";
import { companyMail, passwordLinkEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

// `version` is the row's updated_at; saves must send the version they loaded.
async function readPortal(db: D1Database) {
  const row = await db.prepare("SELECT body,updated_at FROM site_content WHERE id='portal'").first<{ body: string; updated_at: string }>();
  const parsed: unknown = row?.body ? JSON.parse(row.body) : [];
  return { projects: validPortalProjects(parsed) ? parsed : [], version: row?.updated_at ?? null };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    if (!env.DB) throw new Error("No database");
    const { projects, version } = await readPortal(env.DB);
    const owner = isOwner(user);
    const visible = owner ? projects : projects.filter((p) => normalizeEmail(p.clientEmail) === user.email);
    return Response.json({ projects: visible, owner, ...(owner ? { version } : {}) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Portal data is unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!isOwner(user)) return Response.json({ error: "Not authorized" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { projects, version: baseVersion } = (body && typeof body === "object" ? body : {}) as { projects?: unknown; version?: unknown };
  if (!validPortalProjects(projects)) return Response.json({ error: "Check the project, invoice, client email and secure link fields." }, { status: 400 });
  if (baseVersion !== null && typeof baseVersion !== "string") return Response.json({ error: "Reload the editor before saving." }, { status: 400 });
  if (!env.DB) return Response.json({ error: "Portal storage is unavailable" }, { status: 503 });
  const db = env.DB;
  let added: string[], removed: string[], orphaned: string[];
  const version = new Date().toISOString();
  try {
    const previous = await readPortal(db);
    if (previous.version !== baseVersion) return conflict();
    const before = clientEmails(previous.projects), after = clientEmails(projects);
    added = [...after].filter(e => !before.has(e));
    removed = [...before].filter(e => !after.has(e) && !OWNER_EMAILS.includes(e));
    const kept = portalFiles(projects);
    orphaned = [...portalFiles(previous.projects)].filter(url => !kept.has(url));
    // Only write if nobody else saved since this editor loaded (compare-and-set).
    const result = baseVersion === null
      ? await db.prepare("INSERT INTO site_content (id,body,updated_at) VALUES ('portal',?,?) ON CONFLICT(id) DO NOTHING").bind(JSON.stringify(projects), version).run()
      : await db.prepare("UPDATE site_content SET body=?,updated_at=? WHERE id='portal' AND updated_at=?").bind(JSON.stringify(projects), version, baseVersion).run();
    if (result.meta.changes !== 1) return conflict();
  } catch {
    return Response.json({ error: "Portal storage is unavailable" }, { status: 503 });
  }
  await deleteFiles(orphaned);
  const removedAccounts = await removeAccounts(db, removed);
  return Response.json({ ok: true, version, removedAccounts, ...await inviteNewClients(db, added, new URL(request.url).origin) });
}

function conflict() {
  return Response.json({ error: "Someone else saved the client dashboard after you opened it. Copy any changes you need, then reload the page to get the latest version." }, { status: 409 });
}

function clientEmails(projects: PortalProject[]) {
  return new Set(projects.map(p => normalizeEmail(p.clientEmail)).filter((e): e is string => Boolean(e)));
}

function portalFiles(projects: PortalProject[]) {
  return new Set(projects.flatMap(p => [...(p.photos || []), ...(p.documents || []).map(d => d.url), ...p.invoices.map(i => i.invoiceUrl || "")])
    .filter(url => url.startsWith("/api/media/portal/")));
}

// Deletes files that no saved project references any more. Best effort: the
// save already succeeded, and unreferenced files are not served to clients.
async function deleteFiles(urls: string[]) {
  if (!urls.length || !env.BUCKET) return;
  try { await env.BUCKET.delete(urls.map(url => url.slice("/api/media/".length))); }
  catch (error) { console.error("Could not delete removed portal files:", error); }
}

// A client email that no longer appears on any project loses its account and sessions.
async function removeAccounts(db: D1Database, emails: string[]) {
  const removed: string[] = [];
  for (const email of emails) {
    try {
      const results = await db.batch([
        db.prepare("DELETE FROM auth_users WHERE email=?").bind(email),
        db.prepare("DELETE FROM auth_sessions WHERE email=?").bind(email),
        db.prepare("DELETE FROM auth_invitations WHERE email=?").bind(email),
        db.prepare("DELETE FROM auth_email_codes WHERE email=?").bind(email),
      ]);
      if (results[0].meta.changes) removed.push(email);
    } catch (error) { console.error("Could not remove client account:", error); }
  }
  return removed;
}

// Emails a setup link to each newly added client email that has no account yet.
// The save has already succeeded, so failures are reported rather than thrown.
async function inviteNewClients(db: D1Database, emails: string[], origin: string) {
  const invited: string[] = [], failed: string[] = [];
  const mail = companyMail();
  if (!emails.length || !mail) return { invited, failed: mail ? failed : emails };
  const invites = clientInvitations(db);
  for (const email of emails) {
    try {
      if (await db.prepare("SELECT email FROM auth_users WHERE email=?").bind(email).first()) continue;
      const { token, kind } = await invites.create(email);
      await mail.send(passwordLinkEmail(email, `${origin}/set-password#${token}`, kind));
      invited.push(email);
    } catch (error) {
      console.error("Auto-invite failed:", error);
      failed.push(email);
    }
  }
  return { invited, failed };
}
