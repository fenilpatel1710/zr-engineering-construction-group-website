// Sends mail through Gmail API as a Google Workspace user, authenticated with a
// service account that has domain-wide delegation for the gmail.send scope.

const SCOPE = "https://www.googleapis.com/auth/gmail.send";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GmailConfig = {
  serviceAccountEmail: string;
  privateKey: string; // PEM (PKCS#8), literal "\n" sequences allowed
  sender: string; // Workspace mailbox the service account impersonates
};

export type MailMessage = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
};

let cachedToken: { key: string; token: string; expires: number } | null = null;

function base64UrlFromBytes(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64Utf8(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function wrap76(s: string) {
  return s.replace(/.{1,76}/g, "$&\r\n");
}

function headerValue(s: string) {
  return s.replace(/[\r\n]+/g, " ").trim();
}

function encodedWord(s: string) {
  return `=?UTF-8?B?${base64Utf8(headerValue(s))}?=`;
}

async function importKey(pem: string) {
  const body = pem.replace(/\\n/g, "\n").replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function getAccessToken(config: GmailConfig) {
  const cacheKey = `${config.serviceAccountEmail}|${config.sender}`;
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.key === cacheKey && cachedToken.expires - 60 > now) return cachedToken.token;

  const enc = new TextEncoder();
  const header = base64UrlFromBytes(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64UrlFromBytes(enc.encode(JSON.stringify({
    iss: config.serviceAccountEmail,
    sub: config.sender,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })));
  const key = await importKey(config.privateKey);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claims}`)));
  const assertion = `${header}.${claims}.${base64UrlFromBytes(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { key: cacheKey, token: data.access_token, expires: now + data.expires_in };
  return data.access_token;
}

function buildMime(msg: MailMessage) {
  const boundary = `b_${crypto.randomUUID()}`;
  const lines = [
    `From: ${headerValue(msg.from)}`,
    `To: ${headerValue(msg.to)}`,
    msg.replyTo ? `Reply-To: ${headerValue(msg.replyTo)}` : null,
    `Subject: ${encodedWord(msg.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(base64Utf8(msg.text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(base64Utf8(msg.html)),
    `--${boundary}--`,
    "",
  ];
  return lines.filter(l => l !== null).join("\r\n");
}

export async function sendGmail(config: GmailConfig, msg: MailMessage) {
  const token = await getAccessToken(config);
  const raw = base64UrlFromBytes(new TextEncoder().encode(buildMime(msg)));
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send failed (${res.status}): ${await res.text()}`);
}
