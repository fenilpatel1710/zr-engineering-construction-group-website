import { env } from "cloudflare:workers";
import { companyMail, escapeHtml, COMPANY_EMAIL as TO, COMPANY_NAME } from "@/lib/mail";
import { digest, underLimit } from "@/lib/password-auth-service";

const MAX = { name: 200, company: 200, email: 254, phone: 40, details: 4000 };

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return Response.json({ error: "Request not allowed." }, { status: 403 });
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return Response.json({ error: "JSON required." }, { status: 415 });
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const details = typeof body.details === "string" ? body.details.trim() : "";

    if (!name || name.length > MAX.name) return Response.json({ error: "Enter your name." }, { status: 400 });
    if (!email || email.length > MAX.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!details || details.length > MAX.details) return Response.json({ error: "Describe the project." }, { status: 400 });
    if (company.length > MAX.company || phone.length > MAX.phone) return Response.json({ error: "One of the fields is too long." }, { status: 400 });

    // Bots fill the hidden "website" field; pretend success so they don't retry.
    if (typeof body.website === "string" && body.website.trim()) return Response.json({ ok: true });

    const mail = companyMail();
    if (!mail) return Response.json({ error: "Email delivery is not configured. Please contact the company directly." }, { status: 503 });

    // Every inquiry sends a confirmation to the address typed in, so cap how
    // often one visitor, one address, and the whole site can trigger emails.
    if (env.DB) {
      const ip = await digest(request.headers.get("cf-connecting-ip") || "local");
      const limits = await Promise.all([
        underLimit(env.DB, `contact-ip:${ip}`, 3600, 5),
        underLimit(env.DB, `contact-email:${await digest(email.toLowerCase())}`, 86400, 3),
        underLimit(env.DB, "contact-all", 3600, 60),
      ]);
      if (!limits.every(Boolean)) return Response.json({ error: `Too many inquiries right now. Please try again later or email us at ${TO}.` }, { status: 429 });
    }

    const subject = `New project inquiry from ${name}${company ? ` (${company})` : ""}`;
    const text = [
      `Name: ${name}`,
      company ? `Company: ${company}` : null,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      "",
      "Project details:",
      details,
    ].filter(Boolean).join("\n");
    const html = `<p><b>Name:</b> ${escapeHtml(name)}</p>` +
      (company ? `<p><b>Company:</b> ${escapeHtml(company)}</p>` : "") +
      `<p><b>Email:</b> ${escapeHtml(email)}</p>` +
      (phone ? `<p><b>Phone:</b> ${escapeHtml(phone)}</p>` : "") +
      `<p><b>Project details:</b></p><p>${escapeHtml(details).replace(/\n/g, "<br>")}</p>`;

    try {
      await mail.send({ to: TO, replyTo: email, subject, text, html });
    } catch (err) {
      console.error("Contact inquiry delivery failed:", err);
      return Response.json({ error: "Could not send your inquiry. Please try again later." }, { status: 502 });
    }

    // The inquiry is already delivered, so a failed confirmation doesn't fail the request.
    const confirmText = [
      `Hi ${name},`,
      "",
      `Thank you for contacting ${COMPANY_NAME}. We received your project inquiry and will follow up by email soon.`,
      "",
      "Here is a copy of what you sent:",
      "",
      text,
      "",
      "If you need to add anything, just reply to this email.",
      "",
      COMPANY_NAME,
      TO,
    ].join("\n");
    const confirmHtml = `<p>Hi ${escapeHtml(name)},</p>` +
      `<p>Thank you for contacting ${escapeHtml(COMPANY_NAME)}. We received your project inquiry and will follow up by email soon.</p>` +
      "<p>Here is a copy of what you sent:</p>" +
      `<blockquote style="border-left:3px solid #ccc;margin:0;padding-left:12px">${html}</blockquote>` +
      "<p>If you need to add anything, just reply to this email.</p>" +
      `<p>${escapeHtml(COMPANY_NAME)}<br>${TO}</p>`;
    try {
      await mail.send({ to: email, replyTo: TO, subject: `We received your inquiry — ${COMPANY_NAME}`, text: confirmText, html: confirmHtml });
    } catch (err) {
      console.error("Contact confirmation delivery failed:", err);
    }

    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not send your inquiry. Please try again later." }, { status: 500 });
  }
}
