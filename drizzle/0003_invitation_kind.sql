CREATE TABLE `auth_email_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `auth_invitations` ADD `kind` text DEFAULT 'setup' NOT NULL;