export type Invoice = {
  number: string;
  amount: number;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  paymentUrl?: string;
  invoiceUrl?: string;
};

export type PortalProject = {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  location?: string;
  status?: string;
  phase?: string;
  nextMilestone?: string;
  lastUpdate?: string;
  invoices: Invoice[];
  schedule?: { date: string; activity: string; area?: string; note?: string }[];
  timeline?: { name: string; status: string; date?: string }[];
  documents?: { title: string; category: string; url: string }[];
  photos?: string[];
  tickets?: { number: string; subject: string; status: string; created: string }[];
};

export function validPortalProjects(value: unknown): value is PortalProject[] {
  return Array.isArray(value) && value.length <= 200 && value.every((p) =>
    p && typeof p === "object" && typeof p.id === "string" && p.id.length <= 100 &&
    typeof p.title === "string" && p.title.length <= 200 &&
    typeof p.clientEmail === "string" && p.clientEmail.length <= 320 && Array.isArray(p.invoices) &&
    p.invoices.length <= 500 && p.invoices.every((i: Invoice) =>
      i && typeof i.number === "string" && Number.isFinite(i.amount) && i.amount >= 0 &&
      typeof i.dueDate === "string" && ["paid", "pending", "overdue"].includes(i.status) &&
      (!i.paymentUrl || safeHttps(i.paymentUrl)) && (!i.invoiceUrl || safePortalFile(i.invoiceUrl))
    ) &&
    (!p.documents || (Array.isArray(p.documents) && p.documents.length <= 200 && p.documents.every((d) => d && typeof d.title === "string" && typeof d.category === "string" && safePortalFile(d.url)))) &&
    (!p.photos || (Array.isArray(p.photos) && p.photos.length <= 500 && p.photos.every(safePortalFile)))
  );
}

function safeHttps(value: string) { try { return new URL(value).protocol === "https:"; } catch { return false; } }
function safePortalFile(value: string) { return typeof value === "string" && value.startsWith("/api/media/portal/"); }
