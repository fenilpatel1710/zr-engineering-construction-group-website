import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const siteContent = sqliteTable("site_content", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const authUsers = sqliteTable("auth_users", {
  email: text("email").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
});
export const authSessions = sqliteTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, table => [index("auth_sessions_expiry").on(table.expiresAt)]);
export const authRateLimits = sqliteTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, table => [index("auth_rate_limits_expiry").on(table.expiresAt)]);
