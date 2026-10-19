import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { isOwner } from "@/lib/auth";
import { Editor } from "@/components/editor";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath("/admin"));
  if (!isOwner(user)) {
    return <main className="admin-denied"><h1>Website editor</h1><p>This editor is restricted to the site owner account.</p><a href={chatGPTSignOutPath("/")}>Sign out</a></main>;
  }
  return <Editor email={user.email} />;
}
