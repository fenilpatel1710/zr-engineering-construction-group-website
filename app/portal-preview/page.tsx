import { PortalDashboard } from "@/components/portal-dashboard";
import type { PortalProject } from "@/lib/portal";

export const dynamic = "force-static";

const sample: PortalProject[] = [{
  id: "preview-project",
  title: "Sample Retail Renovation",
  clientName: "Sample Client",
  clientEmail: "client@example.com",
  location: "Houston, Texas",
  status: "On track",
  phase: "Construction",
  nextMilestone: "Electrical inspection · Oct 23",
  lastUpdate: "Oct 17, 2026",
  invoices: [
    { number: "INV-1042", amount: 12500, dueDate: "2026-10-25", status: "pending", paymentUrl: "https://example.com/secure-payment" },
    { number: "INV-1037", amount: 8200, dueDate: "2026-10-10", status: "paid" },
    { number: "INV-1030", amount: 6000, dueDate: "2026-09-20", status: "overdue" },
  ],
  schedule: [
    { date: "2026-10-20", activity: "Owner coordination walk", area: "Site", note: "Meet at field office" },
    { date: "2026-10-21", activity: "Electrical rough-in review", area: "Building", note: "Trade coordination" },
    { date: "2026-10-23", activity: "Permit inspection window", area: "Project area", note: "Subject to AHJ confirmation" },
  ],
  timeline: [
    { name: "Scope & design", status: "Complete", date: "2026-07-15" },
    { name: "Permitting", status: "Complete", date: "2026-08-22" },
    { name: "Construction", status: "In progress", date: "2026-09-02" },
    { name: "Inspections", status: "Upcoming", date: "2026-10-23" },
    { name: "Closeout", status: "Upcoming", date: "2026-11-18" },
  ],
  documents: [
    { title: "Issued for construction plan set", category: "Plans", url: "#" },
    { title: "Project safety procedures", category: "Safety", url: "#" },
    { title: "Commercial Construction Safety Field Manual", category: "Safety", url: "/documents/safety-manual-en.pdf" },
  ],
  tickets: [
    { number: "ZR-104", subject: "Confirm delivery access", status: "Open", created: "2026-10-16" },
    { number: "ZR-102", subject: "Request schedule update", status: "Resolved", created: "2026-10-12" },
  ],
}];

export default function PortalPreviewPage() {
  return <PortalDashboard email="Sample client account" previewData={sample} />;
}
