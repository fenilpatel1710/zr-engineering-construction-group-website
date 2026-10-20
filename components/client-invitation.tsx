"use client";
import { useState } from "react";
export function ClientInvitation({email}:{email:string}) {
  const [link,setLink]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function create() {
    setBusy(true);setMessage("");setLink("");
    try {
      const response=await fetch("/api/admin/invitations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
      const result=await response.json() as {path?:string;error?:string};
      if (!response.ok || !result.path?.startsWith("/set-password#")) throw new Error(result.error || "Could not create setup link.");
      setLink(new URL(result.path,location.origin).href);
      setMessage("Share this private link with this client. It expires in 24 hours and works once. Creating another link replaces it.");
    } catch(error) {setMessage(error instanceof Error ? error.message : "Could not create setup link.");}
    finally {setBusy(false);}
  }
  return <section aria-label="Client password setup" style={{margin:"20px 0"}}><b>Client portal access</b><p>Save the client dashboard first, then create a link so the client can choose their own password.</p><button type="button" className="editor-add" disabled={busy || !email.trim()} onClick={()=>void create()}>{busy ? "Creating…" : "Create password setup link"}</button>{message && <p role="status">{message}</p>}{link && <><label style={{display:"block",marginTop:12}}>Private setup link for {email}<input aria-label="Private password setup link" readOnly value={link} onFocus={event=>event.target.select()} style={{display:"block",width:"100%",padding:10,boxSizing:"border-box"}} /></label><button type="button" className="editor-add" onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage("Setup link copied. Share it privately with this client.")).catch(()=>setMessage("Select the link above and copy it manually."))}>Copy link</button></>}</section>;
}
