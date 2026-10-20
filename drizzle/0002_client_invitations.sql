CREATE TABLE `auth_invitations` (
	`email` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_invitations_token_hash_unique` ON `auth_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_invitations_expiry` ON `auth_invitations` (`expires_at`);