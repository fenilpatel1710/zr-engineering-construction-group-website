import { env } from "cloudflare:workers";
import { sendGmail, type MailMessage } from "./gmail";

export const COMPANY_EMAIL = "zrengineering@zrgrouptx.com";
export const COMPANY_NAME = "Z R Engineering & Construction Group";

// Returns null until the Google Workspace service account secrets are configured.
export function companyMail() {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_KEY) return null;
  const sender = env.GMAIL_SENDER || COMPANY_EMAIL;
  const config = { serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey: env.GOOGLE_SERVICE_ACCOUNT_KEY, sender };
  return {
    send: (msg: Omit<MailMessage, "from">) => sendGmail(config, { from: `${COMPANY_NAME} <${sender}>`, ...msg }),
  };
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function passwordCodeEmail(to: string, code: string) {
  const text = [
    `Your verification code to change your client portal password is: ${code}`,
    "",
    "It expires in 10 minutes. If you didn't try to change your password, sign in and change it now, or contact us.",
    "",
    COMPANY_NAME,
    COMPANY_EMAIL,
  ].join("\n");
  const html = "<p>Your verification code to change your client portal password is:</p>" +
    `<p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p>` +
    "<p>It expires in 10 minutes. If you didn't try to change your password, sign in and change it now, or contact us.</p>" +
    `<p>${escapeHtml(COMPANY_NAME)}<br>${COMPANY_EMAIL}</p>`;
  return { to, replyTo: COMPANY_EMAIL, subject: `Your password change code: ${code}`, text, html };
}

export function passwordLinkEmail(to: string, link: string, kind: "setup" | "reset", admin = false) {
  const account = admin ? "website admin" : "client portal";
  const intro = kind === "setup"
    ? `Your Z R Engineering & Construction Group ${account} account is ready. Use the link below to choose your password.`
    : `We received a request to reset your Z R Engineering & Construction Group ${account} password. Use the link below to choose a new one.`;
  const subject = kind === "setup" ? `Set up your ${account} password` : `Reset your ${account} password`;
  const text = [
    intro,
    "",
    link,
    "",
    "This private link works once and expires in 24 hours. Then sign in with this email address.",
    kind === "reset" ? "If you didn't request this, you can ignore this email; your password won't change." : null,
    "",
    COMPANY_NAME,
    COMPANY_EMAIL,
  ].filter(l => l !== null).join("\n");
  const html = `<p>${escapeHtml(intro)}</p>` +
    `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;background:#0b1c33;color:#fff;text-decoration:none;border-radius:4px;font-weight:700">Choose my password</a></p>` +
    `<p style="font-size:13px;color:#555">Or paste this link into your browser:<br>${escapeHtml(link)}</p>` +
    "<p>This private link works once and expires in 24 hours. Then sign in with this email address.</p>" +
    (kind === "reset" ? "<p>If you didn't request this, you can ignore this email; your password won't change.</p>" : "") +
    `<p>${escapeHtml(COMPANY_NAME)}<br>${COMPANY_EMAIL}</p>`;
  return { to, replyTo: COMPANY_EMAIL, subject, text, html };
}
