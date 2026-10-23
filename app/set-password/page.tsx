"use client";
import { useState, type FormEvent } from "react";
export default function SetPasswordPage() {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setMessage("");
    const form=new FormData(event.currentTarget);
    const password=String(form.get("password") || "");
    if (password!==form.get("confirm")) {setMessage("Passwords do not match.");return;}
    const token=location.hash.slice(1);
    if (!token) {setMessage("Open the complete link from your email.");return;}
    setBusy(true);
    try {
      const response=await fetch("/api/auth/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,password})});
      const result=await response.json() as {error?:string};
      if (!response.ok) throw new Error(result.error || "Could not set your password.");
      history.replaceState(null,"","/set-password");setDone(true);
    } catch(error) {setMessage(error instanceof Error ? error.message : "Could not set your password.");}
    finally {setBusy(false);}
  }
  return <main className="signin"><div className="signin-card"><a href="/website.html" className="signin-logo"><img src="/assets/zr-logo.png" alt="Z R Engineering and Construction Group Inc." /></a><h1>{done ? "Your password is set" : "Choose your password"}</h1>{done ? <><p>Your password has been saved. Sign in with the email address this link was sent to.</p><a className="cta" href="/signin">Sign in →</a></> : <><p>Choose a unique password with at least 16 characters. A few random words works well.</p><form onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={16} maxLength={256} required /></label><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={16} maxLength={256} required /></label>{message && <p role="alert">{message}</p>}<button disabled={busy}>{busy ? "Saving…" : "Set my password"}</button></form><p className="note">This private link works once and expires after 24 hours. Need a new link? <a href="/forgot-password">Request one by email</a>.</p></>}<a href="/website.html">← Company website</a></div><style jsx>{`.signin{min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;padding:40px 20px;box-sizing:border-box;background:linear-gradient(160deg,#0b1c33 0%,#123453 55%,#1e4568 100%)}.signin-card{max-width:420px;width:100%;padding:28px;font-family:system-ui;color:#17283c;background:#faf6ee;border:0.5cm solid #1e5b8b;border-radius:10px;box-sizing:border-box}.signin-logo{display:block;text-align:center;margin-bottom:10px}.signin-logo img{width:220px;max-width:100%;height:auto}.signin-card h1{font-weight:800}.signin-card a{color:#1e5b8b;font-weight:700}.signin-card label{display:block;margin:20px 0;font-weight:700}.signin-card input{display:block;width:100%;box-sizing:border-box;padding:12px;margin-top:8px;border:1px solid #8797a7;border-radius:4px;font-weight:400}.signin-card button{width:100%;padding:13px;background:#0b1c33;color:white;border:0;border-radius:4px;cursor:pointer;font-weight:700}.signin-card button:disabled{opacity:.6}.signin-card .cta{display:block;text-align:center;padding:13px;margin:20px 0;background:#0b1c33;color:white;border-radius:4px;text-decoration:none}.signin-card p{line-height:1.6}.signin-card .note{font-size:13px}.signin-card [role=alert]{color:#a32d22;font-weight:700}`}</style></main>;
}
