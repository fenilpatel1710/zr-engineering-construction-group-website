import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const siteContent = sqliteTable("site_content", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  updatedAt: text("updated_at").notNull(),
});
