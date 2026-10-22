"use client";
import { useState, type FormEvent } from "react";
export function ChangePasswordForm({ email }: { email: string }) {
  const [error,setError]=useState("");
  const [info,setInfo]=useState("");
  const [busy,setBusy]=useState(false);
  const [sending,setSending]=useState(false);
  const [codeSent,setCodeSent]=useState(false);
  const [done,setDone]=useState(false);
  async function post(path:string,body?:object) {
    const response = await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body ?? {})});
    const result = await response.json().catch(()=>({})) as {error?:string};
    if (response.status===401) { location.assign("/signin?return_to=%2Fportal"); return false; }
    if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
    return true;
  }
  async function sendCode() {
    setError(""); setInfo(""); setSending(true);
    try { if (await post("/api/auth/password/code")) { setCodeSent(true); setInfo(`We emailed a 6-digit code to ${email}. It expires in 10 minutes.`); } }
    catch (e) { setError(e instanceof Error ? e.message : "Could not send a code."); }
    finally { setSending(false); }
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setInfo("");
    const form=new FormData(event.currentTarget);
    const password=String(form.get("password") || "");
    if (password!==form.get("confirm")) { setError("New passwords do not match."); return; }
    setBusy(true);
    try { if (await post("/api/auth/password",{current:form.get("current"),password,code:form.get("code")})) setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not change your password."); }
    finally { setBusy(false); }
  }
  return <main className="signin"><div className="signin-card"><a href="/website.html" className="signin-logo"><img src="/assets/zr-logo.png" alt="Z R Engineering and Construction Group Inc." /></a><h1>{done ? "Password changed" : "Change your password"}</h1>{done ? <p>Your new password is saved. Any other devices signed in to <b>{email}</b> have been signed out.</p> : <><p>Signed in as <b>{email}</b>. To protect your account, we'll email you a verification code.</p><form onSubmit={submit}><label>Current password<input type="password" name="current" autoComplete="current-password" required maxLength={256} /></label><label>New password<input type="password" name="password" autoComplete="new-password" required minLength={16} maxLength={256} /></label><label>Confirm new password<input type="password" name="confirm" autoComplete="new-password" required minLength={16} maxLength={256} /></label><p className="hint">Use at least 16 characters. A few random words works well.</p><button type="button" className="secondary" disabled={sending} onClick={()=>void sendCode()}>{sending ? "Sending…" : codeSent ? "Resend code" : "Email me a verification code"}</button><label>Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required placeholder="6-digit code" /></label>{info && <p role="status">{info}</p>}{error && <p role="alert">{error}</p>}<button disabled={busy || !codeSent}>{busy ? "Saving…" : "Change password"}</button></form><p>Forgot your current password? <a href="/forgot-password">Reset it by email</a>.</p></>}<a href="/portal">← Back to your portal</a></div><style jsx>{`.signin{min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;padding:40px 20px;box-sizing:border-box;background:linear-gradient(160deg,#0b1c33 0%,#123453 55%,#1e4568 100%)}.signin-card{max-width:420px;width:100%;padding:28px;font-family:system-ui;color:#17283c;background:#faf6ee;border:0.5cm solid #1e5b8b;border-radius:10px;box-sizing:border-box}.signin-logo{display:block;text-align:center;margin-bottom:10px}.signin-logo img{width:220px;max-width:100%;height:auto}.signin-card h1{font-weight:800}.signin-card a{color:#1e5b8b;font-weight:700}.signin-card label{display:block;margin:20px 0;font-weight:700}.signin-card input{display:block;width:100%;box-sizing:border-box;padding:12px;margin-top:8px;border:1px solid #8797a7;border-radius:4px;font-weight:400}.signin-card button{width:100%;padding:13px;background:#0b1c33;color:white;border:0;border-radius:4px;cursor:pointer;font-weight:700}.signin-card button.secondary{background:transparent;color:#0b1c33;border:2px solid #0b1c33}.signin-card button:disabled{opacity:.6}.signin-card p{line-height:1.6}.signin-card .hint{font-size:13px;margin-top:-8px}.signin-card [role=alert]{color:#a32d22;font-weight:700}.signin-card [role=status]{color:#1d6b43}`}</style></main>;
}
