"use client";
import { useState, type FormEvent } from "react";
export default function ForgotPasswordPage() {
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [sentTo,setSentTo]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const email=String(new FormData(event.currentTarget).get("email") || "");
    try {
      const response = await fetch("/api/auth/forgot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
      const result = await response.json() as {error?:string};
      if (!response.ok) throw new Error(result.error || "Could not send a reset link.");
      setSentTo(email);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send a reset link."); }
    finally { setBusy(false); }
  }
  return <main className="signin"><div className="signin-card"><a href="/website.html" className="signin-logo"><img src="/assets/zr-logo.png" alt="Z R Engineering and Construction Group Inc." /></a><h1>{sentTo ? "Check your email" : "Reset your password"}</h1>{sentTo ? <><p>If <b>{sentTo}</b> is registered, we've sent it a link to choose a new password. The link expires in 24 hours.</p><p>Don't see it? Check your spam folder, or contact your project manager.</p></> : <><p>Enter the email address you sign in with. We'll email you a link to choose a new password. This also works if you haven't set a password yet.</p><form onSubmit={submit}><label>Email address<input type="email" name="email" autoComplete="username" required maxLength={254} /></label>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? "Sending…" : "Email me a reset link"}</button></form></>}<a href="/signin">← Back to sign in</a></div><style jsx>{`.signin{min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;padding:40px 20px;box-sizing:border-box;background:linear-gradient(160deg,#0b1c33 0%,#123453 55%,#1e4568 100%)}.signin-card{max-width:420px;width:100%;padding:28px;font-family:system-ui;color:#17283c;background:#faf6ee;border:0.5cm solid #1e5b8b;border-radius:10px;box-sizing:border-box}.signin-logo{display:block;text-align:center;margin-bottom:10px}.signin-logo img{width:220px;max-width:100%;height:auto}.signin-card h1{font-weight:800}.signin-card a{color:#1e5b8b;font-weight:700}.signin-card label{display:block;margin:20px 0;font-weight:700}.signin-card input{display:block;width:100%;box-sizing:border-box;padding:12px;margin-top:8px;border:1px solid #8797a7;border-radius:4px;font-weight:400}.signin-card button{width:100%;padding:13px;margin-bottom:16px;background:#0b1c33;color:white;border:0;border-radius:4px;cursor:pointer;font-weight:700}.signin-card button:disabled{opacity:.6}.signin-card p{line-height:1.6}.signin-card [role=alert]{color:#a32d22;font-weight:700}`}</style></main>;
}
