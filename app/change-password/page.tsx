import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { ChangePasswordForm } from "@/components/change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireChatGPTUser("/portal");
  return <ChangePasswordForm email={user.email} />;
}
