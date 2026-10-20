import { env } from "cloudflare:workers";

const MAX = { name: 200, company: 200, email: 254, phone: 40, details: 4000 };
const TO = "zrengineering@zrgrouptx.com";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

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

    if (!env.RESEND_API_KEY) return Response.json({ error: "Email delivery is not configured. Please contact the company directly." }, { status: 503 });

    const from = env.CONTACT_FROM_EMAIL || "Z R Engineering Website <onboarding@resend.dev>";
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

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({ from, to: [TO], reply_to: email, subject, text, html }),
    });

    if (!resendResponse.ok) return Response.json({ error: "Could not send your inquiry. Please try again later." }, { status: 502 });

    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not send your inquiry. Please try again later." }, { status: 500 });
  }
}
