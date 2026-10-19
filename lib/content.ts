import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { siteContent } from "@/db/schema";
import { defaultContent } from "@/lib/default-content";

export type SiteContent = typeof defaultContent;

export async function getSiteContent(): Promise<SiteContent> {
  try {
    const [row] = await getDb()
      .select({ body: siteContent.body })
      .from(siteContent)
      .where(eq(siteContent.id, "main"))
      .limit(1);
    if (row?.body) {
      const saved = JSON.parse(row.body) as Partial<SiteContent>;
      return { ...defaultContent, ...saved, copy: { ...defaultContent.copy, ...saved.copy } };
    }
  } catch {
    // A fresh database uses the source defaults until the first owner save.
  }
  return defaultContent;
}
