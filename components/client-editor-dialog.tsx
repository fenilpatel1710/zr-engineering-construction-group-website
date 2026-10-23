"use client";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { Invoice, PortalProject } from "@/lib/portal";
import { ClientInvitation } from "@/components/client-invitation";

type UploadKind = "portalPhoto" | "portalDocument";
type Uploader = (file: File, kind: UploadKind) => Promise<{ url: string; fileName: string }>;
type Schedule = NonNullable<PortalProject["schedule"]>[number];
type Milestone = NonNullable<PortalProject["timeline"]>[number];
type Ticket = NonNullable<PortalProject["tickets"]>[number];

const TABS = [["details","Details"],["access","Portal access"],["invoices","Invoices"],["schedule","Schedule"],["timeline","Timeline"],["files","Files"],["tickets","Tickets"]] as const;
type Tab = typeof TABS[number][0];
const fileName = (url: string) => decodeURIComponent(url.split("/").pop() || "file").replace(/^[0-9a-f-]{36}-/, "");

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? "wide" : undefined}><span>{label}</span>{children}</label>;
}

// Generic editor for a list of rows (schedule, timeline, tickets, invoices).
function RowList<T>({ items, onChange, blank, addLabel, empty, render }: {
  items: T[]; onChange: (items: T[]) => void; blank: () => T; addLabel: string; empty: string;
  render: (item: T, set: (patch: Partial<T>) => void) => ReactNode;
}) {
  return <div className="ced-rows">
    {items.length ? items.map((item, i) => <div className="ced-row" key={i}>
      <div className="editor-fields">{render(item, patch => onChange(items.map((x, j) => j === i ? { ...x, ...patch } : x)))}</div>
      <div className="ced-row-actions">
        <button type="button" className="ced-link" disabled={i === 0} onClick={() => { const next = [...items]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; onChange(next); }}>↑ Move up</button>
        <button type="button" className="editor-remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
      </div>
    </div>) : <p className="ced-empty">{empty}</p>}
    <button type="button" className="editor-add" onClick={() => onChange([...items, blank()])}>{addLabel}</button>
  </div>;
}

export function ClientEditorDialog({ project, onChange, onRemove, onClose, onSave, upload, busy, status, dirty }: {
  project: PortalProject; onChange: (p: PortalProject) => void; onRemove: () => void; onClose: () => void;
  onSave: () => Promise<void>; upload: Uploader; busy: boolean; status: string; dirty: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>("details");
  const [uploading, setUploading] = useState("");
  const [note, setNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);

  const set = (patch: Partial<PortalProject>) => onChange({ ...project, ...patch });
  const text = (key: "title"|"clientName"|"clientEmail"|"location"|"status"|"phase"|"nextMilestone"|"lastUpdate", label: string, wide?: boolean) =>
    <Field label={label} wide={wide}><input value={project[key] || ""} onChange={e => set({ [key]: e.target.value })} /></Field>;

  async function uploadFiles(e: ChangeEvent<HTMLInputElement>, kind: UploadKind) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setNote("");
    try {
      let next = project;
      for (const [n, file] of files.entries()) {
        setUploading(`Uploading ${n + 1} of ${files.length}: ${file.name}…`);
        const f = await upload(file, kind);
        next = kind === "portalPhoto"
          ? { ...next, photos: [...(next.photos || []), f.url] }
          : { ...next, documents: [...(next.documents || []), { title: f.fileName.replace(/\.pdf$/i, ""), category: "Project document", url: f.url }] };
        onChange(next);
      }
      setNote(`Uploaded ${files.length} file(s). Save changes to show them to the client.`);
    } catch (err) { setNote(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(""); }
  }
  async function attachInvoicePdf(e: ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNote(""); setUploading(`Uploading ${file.name}…`);
    try {
      const f = await upload(file, "portalDocument");
      set({ invoices: project.invoices.map((inv, i) => i === index ? { ...inv, invoiceUrl: f.url } : inv) });
      setNote("Invoice PDF attached. Save changes to show it to the client.");
    } catch (err) { setNote(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(""); }
  }

  const docs = project.documents || [], photos = project.photos || [];
  const counts: Partial<Record<Tab, number>> = { invoices: project.invoices.length, schedule: project.schedule?.length || 0, timeline: project.timeline?.length || 0, files: docs.length + photos.length, tickets: project.tickets?.length || 0 };

  return <dialog ref={ref} className="ced" onClose={onClose} onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className="ced-head">
      <div><b>{project.clientName || "New client"}</b><small>{project.clientEmail || "Sign-in email not set"} · {project.title}{project.location ? ` · ${project.location}` : ""}</small></div>
      <button type="button" className="ced-close" aria-label="Close" onClick={onClose}>×</button>
    </header>
    <nav className="ced-tabs" aria-label="Client sections">{TABS.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}{counts[id] ? <em>{counts[id]}</em> : null}</button>)}</nav>
    <div className="ced-body">
      {tab === "details" && <>
        <div className="editor-fields">
          {text("clientName", "Client name")}{text("clientEmail", "Client sign-in email")}
          {text("title", "Project title")}{text("location", "Location")}
          {text("status", "Overall status")}{text("phase", "Current phase")}
          {text("nextMilestone", "Next milestone")}{text("lastUpdate", "Last update", true)}
        </div>
        <div className="ced-danger">
          {confirmRemove
            ? <><span>Remove this client, their files and their sign-in account? This takes effect when you save.</span><button type="button" className="editor-remove" onClick={onRemove}>Yes, remove client</button><button type="button" className="ced-link" onClick={() => setConfirmRemove(false)}>Cancel</button></>
            : <button type="button" className="editor-remove" onClick={() => setConfirmRemove(true)}>Remove client</button>}
        </div>
      </>}
      {tab === "access" && <ClientInvitation key={project.clientEmail} email={project.clientEmail} />}
      {tab === "invoices" && <RowList<Invoice> items={project.invoices} onChange={invoices => set({ invoices })} addLabel="+ Add invoice" empty="No invoices yet."
        blank={() => ({ number: `INV-${String(project.invoices.length + 1).padStart(3, "0")}`, amount: 0, dueDate: "", status: "pending" })}
        render={(inv, patch) => <>
          <Field label="Invoice number"><input value={inv.number} onChange={e => patch({ number: e.target.value })} /></Field>
          <Field label="Amount (USD)"><input type="number" min="0" step="0.01" value={inv.amount} onChange={e => patch({ amount: Number(e.target.value) })} /></Field>
          <Field label="Due date"><input type="date" value={inv.dueDate} onChange={e => patch({ dueDate: e.target.value })} /></Field>
          <Field label="Status"><select value={inv.status} onChange={e => patch({ status: e.target.value as Invoice["status"] })}><option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></Field>
          <Field label="Hosted ACH payment URL (https://)" wide><input value={inv.paymentUrl || ""} placeholder="https://…" onChange={e => patch({ paymentUrl: e.target.value })} /></Field>
          <div className="wide ced-inline">{inv.invoiceUrl
            ? <><a href={inv.invoiceUrl} target="_blank" rel="noreferrer">📄 {fileName(inv.invoiceUrl)}</a><button type="button" className="ced-link" onClick={() => patch({ invoiceUrl: undefined })}>Remove PDF</button></>
            : <span className="ced-muted">No invoice PDF attached.</span>}
            <label className="editor-add">{inv.invoiceUrl ? "Replace invoice PDF" : "Attach invoice PDF"}<input type="file" accept="application/pdf" hidden onChange={e => void attachInvoicePdf(e, project.invoices.indexOf(inv))} /></label>
          </div>
        </>} />}
      {tab === "schedule" && <RowList<Schedule> items={project.schedule || []} onChange={schedule => set({ schedule })} addLabel="+ Add schedule item" empty="No scheduled work yet."
        blank={() => ({ date: "", activity: "" })}
        render={(s, patch) => <>
          <Field label="Date"><input type="date" value={s.date} onChange={e => patch({ date: e.target.value })} /></Field>
          <Field label="Activity"><input value={s.activity} onChange={e => patch({ activity: e.target.value })} /></Field>
          <Field label="Area"><input value={s.area || ""} onChange={e => patch({ area: e.target.value })} /></Field>
          <Field label="Note"><input value={s.note || ""} onChange={e => patch({ note: e.target.value })} /></Field>
        </>} />}
      {tab === "timeline" && <RowList<Milestone> items={project.timeline || []} onChange={timeline => set({ timeline })} addLabel="+ Add milestone" empty="No timeline milestones yet."
        blank={() => ({ name: "", status: "Upcoming" })}
        render={(t, patch) => <>
          <Field label="Milestone"><input value={t.name} onChange={e => patch({ name: e.target.value })} /></Field>
          <Field label="Status"><input list="ced-milestone-status" value={t.status} onChange={e => patch({ status: e.target.value })} /></Field>
          <Field label="Date"><input type="date" value={t.date || ""} onChange={e => patch({ date: e.target.value })} /></Field>
        </>} />}
      {tab === "files" && <>
        <div className="upload-row">
          <label className="editor-add">Upload project PDF<input type="file" accept="application/pdf" multiple hidden disabled={Boolean(uploading)} onChange={e => void uploadFiles(e, "portalDocument")} /></label>
          <label className="editor-add">Upload project photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={Boolean(uploading)} onChange={e => void uploadFiles(e, "portalPhoto")} /></label>
          <span>{photos.length} photo(s) · {docs.length} document(s)</span>
        </div>
        <h3 className="ced-sub">Documents</h3>
        {docs.length ? <div className="ced-files">{docs.map((d, i) => <div className="ced-file" key={d.url}>
          <span className="ced-file-icon">PDF</span>
          <div className="editor-fields">
            <Field label="Title"><input value={d.title} onChange={e => set({ documents: docs.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} /></Field>
            <Field label="Category"><input list="ced-doc-category" value={d.category} onChange={e => set({ documents: docs.map((x, j) => j === i ? { ...x, category: e.target.value } : x) })} /></Field>
          </div>
          <div className="ced-file-actions"><a href={d.url} target="_blank" rel="noreferrer">Preview</a><button type="button" className="editor-remove" onClick={() => set({ documents: docs.filter((_, j) => j !== i) })}>Remove</button></div>
        </div>)}</div> : <p className="ced-empty">No documents yet.</p>}
        <h3 className="ced-sub">Photos</h3>
        {photos.length ? <div className="ced-photos">{photos.map((url, i) => <figure key={url}>
          <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={fileName(url)} loading="lazy" /></a>
          <figcaption title={fileName(url)}>{fileName(url)}</figcaption>
          <div><a href={url} target="_blank" rel="noreferrer">Preview</a><button type="button" className="ced-link danger" onClick={() => set({ photos: photos.filter((_, j) => j !== i) })}>Remove</button></div>
        </figure>)}</div> : <p className="ced-empty">No photos yet.</p>}
        <p className="ced-muted">Removed files are deleted from storage when you save.</p>
      </>}
      {tab === "tickets" && <RowList<Ticket> items={project.tickets || []} onChange={tickets => set({ tickets })} addLabel="+ Add ticket" empty="No tickets yet."
        blank={() => ({ number: `T-${String((project.tickets?.length || 0) + 1).padStart(3, "0")}`, subject: "", status: "Open", created: new Date().toISOString().slice(0, 10) })}
        render={(t, patch) => <>
          <Field label="Ticket number"><input value={t.number} onChange={e => patch({ number: e.target.value })} /></Field>
          <Field label="Status"><input list="ced-ticket-status" value={t.status} onChange={e => patch({ status: e.target.value })} /></Field>
          <Field label="Subject" wide><input value={t.subject} onChange={e => patch({ subject: e.target.value })} /></Field>
          <Field label="Created"><input type="date" value={t.created} onChange={e => patch({ created: e.target.value })} /></Field>
        </>} />}
    </div>
    <datalist id="ced-milestone-status"><option value="Upcoming" /><option value="In progress" /><option value="Complete" /><option value="Delayed" /></datalist>
    <datalist id="ced-ticket-status"><option value="Open" /><option value="In progress" /><option value="Resolved" /><option value="Closed" /></datalist>
    <datalist id="ced-doc-category"><option value="Project document" /><option value="Contract" /><option value="Drawings" /><option value="Permit" /><option value="Inspection" /><option value="Change order" /></datalist>
    <footer className="ced-foot">
      <span role="status">{dirty && !uploading && <span className="unsaved-badge">Unsaved changes</span>}{uploading || note || status}</span>
      <button type="button" className="ced-link" onClick={onClose}>Close</button>
      <button type="button" className="editor-save" disabled={busy || Boolean(uploading)} onClick={() => void onSave()}>{busy ? "Saving…" : "Save changes"}</button>
    </footer>
  </dialog>;
}
