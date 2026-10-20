"use client";
import { useState, type FormEvent } from "react";
export default function SignInPage() {
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:form.get("email"),password:form.get("password"),returnTo:new URLSearchParams(location.search).get("return_to")})});
      const result = await response.json() as {error?:string;redirect?:string};
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      location.assign(result.redirect === "/admin" ? "/admin" : "/portal");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in."); setBusy(false); }
  }
  return <main className="signin"><a href="/website.html">Z R Engineering &amp; Construction</a><h1>Client portal sign in</h1><p>Use the account provided by your project manager.</p><form onSubmit={submit}><label>Email address<input type="email" name="email" autoComplete="username" required maxLength={254} /></label><label>Password<input type="password" name="password" autoComplete="current-password" required maxLength={256} /></label>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form><p>Need an account or a password reset? Contact your project manager.</p><a href="/website.html">← Company website</a><style jsx>{`.signin{max-width:420px;margin:70px auto;padding:28px;font-family:system-ui;color:#17283c}.signin a{color:#1e5b8b}.signin label{display:block;margin:20px 0}.signin input{display:block;width:100%;box-sizing:border-box;padding:12px;margin-top:8px;border:1px solid #8797a7;border-radius:4px}.signin button{width:100%;padding:13px;background:#0b1c33;color:white;border:0;border-radius:4px;cursor:pointer}.signin button:disabled{opacity:.6}.signin p{line-height:1.6}.signin [role=alert]{color:#a32d22}`}</style></main>;
}
