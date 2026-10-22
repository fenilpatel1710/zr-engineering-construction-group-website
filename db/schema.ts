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

export const authInvitations = sqliteTable("auth_invitations", {
  email: text("email").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  kind: text("kind").notNull().default("setup"),
}, table => [index("auth_invitations_expiry").on(table.expiresAt)]);

// One-time codes emailed to a signed-in user to confirm a password change.
export const authEmailCodes = sqliteTable("auth_email_codes", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
});
