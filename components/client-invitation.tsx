"use client";
import { useState } from "react";
export function ClientInvitation({email}:{email:string}) {
  const [link,setLink]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState<""|"link"|"email">("");
  async function create(send:boolean) {
    setBusy(send ? "email" : "link");setMessage("");setLink("");
    try {
      const response=await fetch("/api/admin/invitations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,send})});
      const result=await response.json() as {path?:string;kind?:"setup"|"reset";sent?:boolean;error?:string};
      if (!response.ok || !result.path?.startsWith("/set-password#")) throw new Error(result.error || "Could not create link.");
      const what=result.kind==="reset" ? "password reset link (this client already has an account)" : "password setup link";
      if (send && result.sent) {setMessage(`Emailed a ${what} to ${email}. It expires in 24 hours and works once.`);return;}
      setLink(new URL(result.path,location.origin).href);
      setMessage(send
        ? `Could not email the link. Copy this ${what} and send it to the client privately instead.`
        : `Share this private ${what} with the client. It expires in 24 hours and works once. Creating another link replaces it.`);
    } catch(error) {setMessage(error instanceof Error ? error.message : "Could not create link.");}
    finally {setBusy("");}
  }
  return <section aria-label="Client password setup" style={{margin:"20px 0"}}><b>Client portal access</b><p>Save the client dashboard first. New clients get a link to choose their password; clients who already have an account get a reset link. Clients can also reset their own password from the sign-in page.</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="editor-add" disabled={Boolean(busy) || !email.trim()} onClick={()=>void create(true)}>{busy==="email" ? "Sending…" : "Email password link to client"}</button><button type="button" className="editor-add" disabled={Boolean(busy) || !email.trim()} onClick={()=>void create(false)}>{busy==="link" ? "Creating…" : "Create link to copy"}</button></div>{message && <p role="status">{message}</p>}{link && <><label style={{display:"block",marginTop:12}}>Private password link for {email}<input aria-label="Private password link" readOnly value={link} onFocus={event=>event.target.select()} style={{display:"block",width:"100%",padding:10,boxSizing:"border-box"}} /></label><button type="button" className="editor-add" onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage("Link copied. Share it privately with this client.")).catch(()=>setMessage("Select the link above and copy it manually."))}>Copy link</button></>}</section>;
}
