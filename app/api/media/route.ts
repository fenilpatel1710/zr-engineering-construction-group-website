import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-90) || "file";
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!isOwner(user)) return Response.json({ error: "Not authorized" }, { status: 403 });
  if (!env.BUCKET) return Response.json({ error: "File storage is unavailable" }, { status: 503 });
  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File)) return Response.json({ error: "Choose a file" }, { status: 400 });
  const allowedImage = ["image/jpeg", "image/png", "image/webp"];
  const allowedDocument = ["application/pdf"];
  const isImage = kind === "photo" && allowedImage.includes(file.type) && file.size <= 15 * 1024 * 1024;
  const isManual = kind === "manual" && allowedDocument.includes(file.type) && file.size <= 25 * 1024 * 1024;
  const isPortalPhoto = kind === "portalPhoto" && allowedImage.includes(file.type) && file.size <= 15 * 1024 * 1024;
  const isPortalDocument = kind === "portalDocument" && allowedDocument.includes(file.type) && file.size <= 25 * 1024 * 1024;
  if (!isImage && !isManual && !isPortalPhoto && !isPortalDocument) return Response.json({ error: "Upload a JPG, PNG or WebP photo up to 15 MB, or a PDF up to 25 MB." }, { status: 400 });
  const folder = isPortalPhoto ? "portal/photos" : isPortalDocument ? "portal/documents" : isImage ? "photos" : "manuals";
  const key = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  try {
    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: folder.startsWith("portal/") ? "private, no-store" : "public, max-age=31536000, immutable" },
    });
    return Response.json({ url: `/api/media/${key}`, fileName: file.name });
  } catch {
    return Response.json({ error: "Could not save the file" }, { status: 503 });
  }
}
