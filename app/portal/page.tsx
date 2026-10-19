import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PortalDashboard } from "@/components/portal-dashboard";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const user = await requireChatGPTUser("/portal");
  return <PortalDashboard email={user.email} />;
}
