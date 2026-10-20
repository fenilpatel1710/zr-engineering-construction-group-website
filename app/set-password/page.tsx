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
    if (!token) {setMessage("Open the complete setup link provided by your project manager.");return;}
    setBusy(true);
    try {
      const response=await fetch("/api/auth/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,password})});
      const result=await response.json() as {error?:string};
      if (!response.ok) throw new Error(result.error || "Could not set your password.");
      history.replaceState(null,"","/set-password");setDone(true);
    } catch(error) {setMessage(error instanceof Error ? error.message : "Could not set your password.");}
    finally {setBusy(false);}
  }
  return <main className="setup"><a href="/website.html">Z R Engineering &amp; Construction</a><h1>{done ? "Your account is ready" : "Choose your portal password"}</h1>{done ? <><p>Your password has been saved. Sign in using the email address your project manager assigned to your account.</p><a href="/signin">Sign in to your portal →</a></> : <><p>Choose a unique password with at least 16 characters.</p><form onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={16} maxLength={256} required /></label><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={16} maxLength={256} required /></label>{message && <p role="alert">{message}</p>}<button disabled={busy}>{busy ? "Saving…" : "Set my password"}</button></form><p>This private link works once and expires after 24 hours. Need a new link? Contact your project manager.</p></>}<style jsx>{`.setup{max-width:440px;margin:70px auto;padding:28px;font-family:system-ui;color:#17283c}.setup a{color:#1e5b8b}.setup label{display:block;margin:20px 0}.setup input{display:block;width:100%;box-sizing:border-box;padding:12px;margin-top:8px;border:1px solid #8797a7;border-radius:4px}.setup button{width:100%;padding:13px;background:#0b1c33;color:white;border:0;border-radius:4px;cursor:pointer}.setup button:disabled{opacity:.6}.setup p{line-height:1.6}.setup [role=alert]{color:#a32d22}`}</style></main>;
}
