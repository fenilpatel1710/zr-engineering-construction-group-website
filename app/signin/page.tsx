"use client";
import { useEffect, useState, type FormEvent } from "react";
export default function SignInPage() {
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [admin,setAdmin]=useState(false);
  useEffect(()=>{ setAdmin(new URLSearchParams(location.search).get("return_to")==="/admin"); },[]);
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
  return <main className="signin"><div className="signin-card"><a href="/website.html" className="signin-logo"><img src="/assets/zr-logo.png" alt="Z R Engineering and Construction Group Inc." /></a>{admin && <span className="badge">Staff only</span>}<h1>{admin ? "Admin sign in" : "Client portal sign in"}</h1><p>{admin ? "Sign in to edit the website and manage client projects." : "Use the account provided by your project manager."}</p><form onSubmit={submit}><label>Email address<input type="email" name="email" autoComplete="username" required maxLength={254} /></label><label>Password<input type="password" name="password" autoComplete="current-password" required maxLength={256} /></label>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form><p><a href="/forgot-password">Forgot your password?</a> You can also use this to set your password for the first time.</p><p className="switch">{admin ? <a href="/signin">Client? Sign in to the client portal</a> : <a href="/signin?return_to=%2Fadmin">Staff sign in</a>}</p><a href="/website.html">← Company website</a></div><style jsx>{`.signin{min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;padding:40px 20px;box-sizing:border-box;background:linear-gradient(160deg,#0b1c33 0%,#123453 55%,#1e4568 100%)}.signin-card{max-width:420px;width:100%;padding:28px;font-family:system-ui;color:#17283c;background:#faf6ee;border:0.5cm solid #1e5b8b;border-radius:10px;box-sizing:border-box}.signin-logo{display:block;text-align:center;margin-bottom:10px}.signin-logo img{width:220px;max-width:100%;height:auto}.badge{display:inline-block;background:#0b1c33;color:#faf6ee;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:3px}.signin-card h1{font-weight:800}.signin-card a{color:#1e5b8b;font-weight:700}.signin-card label{display:block;margin:20px 0;font-weight:700}.signin-card input{display:block;width:100%;box-sizing:border-box;padding:12px;margin-top:8px;border:1px solid #8797a7;border-radius:4px;font-weight:400}.signin-card button{width:100%;padding:13px;background:#0b1c33;color:white;border:0;border-radius:4px;cursor:pointer;font-weight:700}.signin-card button:disabled{opacity:.6}.signin-card p{line-height:1.6}.signin-card .switch{font-size:14px;border-top:1px solid #d9d2c3;padding-top:14px}.signin-card [role=alert]{color:#a32d22;font-weight:700}`}</style></main>;
}
