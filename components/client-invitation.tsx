"use client";
import { useCallback, useEffect, useState } from "react";
type Status = {hasAccount:boolean;pendingLink:{kind:"setup"|"reset";expiresAt:number}|null;locked:boolean};
const statusLabel = (s:Status) => {
  const parts=[s.hasAccount ? "✓ Has a password" : "No account yet"];
  if (s.pendingLink) parts.push(`${s.pendingLink.kind==="reset" ? "reset" : "setup"} link sent, expires ${new Date(s.pendingLink.expiresAt*1000).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}`);
  return parts.join(" · ");
};
export function ClientInvitation({email}:{email:string}) {
  const [link,setLink]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState<""|"link"|"email"|"unlock">("");
  const [status,setStatus]=useState<Status|null>(null);
  const post = useCallback(async (path:string, body:object) => {
    const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,...body})});
    const result=await response.json().catch(()=>({})) as Record<string,unknown>;
    if (!response.ok) throw new Error(typeof result.error==="string" ? result.error : "Something went wrong.");
    return result;
  },[email]);
  const refresh = useCallback(async () => {
    if (!email.trim()) { setStatus(null); return; }
    try { setStatus(await post("/api/admin/clients",{action:"status"}) as Status); } catch { setStatus(null); }
  },[email,post]);
  useEffect(()=>{
    void refresh();
    const onSaved=()=>void refresh();
    window.addEventListener("portal-saved",onSaved);
    return ()=>window.removeEventListener("portal-saved",onSaved);
  },[refresh]);
  async function create(send:boolean) {
    setBusy(send ? "email" : "link");setMessage("");setLink("");
    try {
      const result=await post("/api/admin/invitations",{send}) as {path?:string;kind?:"setup"|"reset";sent?:boolean};
      if (!result.path?.startsWith("/set-password#")) throw new Error("Could not create link.");
      const what=result.kind==="reset" ? "password reset link (this client already has an account)" : "password setup link";
      if (send && result.sent) setMessage(`Emailed a ${what} to ${email}. It expires in 24 hours and works once.`);
      else {
        setLink(new URL(result.path,location.origin).href);
        setMessage(send
          ? `Could not email the link. Copy this ${what} and send it to the client privately instead.`
          : `Share this private ${what} with the client. It expires in 24 hours and works once. Creating another link replaces it.`);
      }
    } catch(error) {setMessage(error instanceof Error ? error.message : "Could not create link.");}
    finally {setBusy("");void refresh();}
  }
  async function unlock() {
    setBusy("unlock");setMessage("");
    try { setStatus(await post("/api/admin/clients",{action:"unlock"}) as Status); setMessage(`${email} is unlocked and can try signing in or requesting a reset again now.`); }
    catch(error) {setMessage(error instanceof Error ? error.message : "Could not unlock.");}
    finally {setBusy("");}
  }
  return <section aria-label="Client password setup" style={{margin:"20px 0"}}><b>Client portal access</b>{status ? <p style={{margin:"6px 0"}}><span>{statusLabel(status)}</span>{status.locked && <span style={{color:"#a32d22",fontWeight:700}}> · Locked out (too many wrong passwords)</span>}</p> : email.trim() ? <p style={{margin:"6px 0"}}>Save the client dashboard to see this client&apos;s account status.</p> : null}<p>New clients are emailed a setup link automatically when you save. Clients who already have an account get a reset link. Clients can also reset their own password from the sign-in page.</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="editor-add" disabled={Boolean(busy) || !email.trim()} onClick={()=>void create(true)}>{busy==="email" ? "Sending…" : status?.hasAccount ? "Email password reset link" : "Email password setup link"}</button><button type="button" className="editor-add" disabled={Boolean(busy) || !email.trim()} onClick={()=>void create(false)}>{busy==="link" ? "Creating…" : "Create link to copy"}</button><button type="button" className="editor-add" disabled={Boolean(busy) || !email.trim()} onClick={()=>void unlock()} title="Clears failed sign-in and reset-request limits for this email">{busy==="unlock" ? "Unlocking…" : "Unlock account"}</button></div>{message && <p role="status">{message}</p>}{link && <><label style={{display:"block",marginTop:12}}>Private password link for {email}<input aria-label="Private password link" readOnly value={link} onFocus={event=>event.target.select()} style={{display:"block",width:"100%",padding:10,boxSizing:"border-box"}} /></label><button type="button" className="editor-add" onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage("Link copied. Share it privately with this client.")).catch(()=>setMessage("Select the link above and copy it manually."))}>Copy link</button></>}</section>;
}
