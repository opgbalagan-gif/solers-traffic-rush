CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`phone` text NOT NULL,
	`consent_at` integer NOT NULL,
	`consent_version` text NOT NULL,
	`score` integer NOT NULL,
	`crm_status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`crm_status`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`started_at` integer NOT NULL,
	`name` text,
	`score` integer,
	`distance` integer,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `runs_score_idx` ON `runs` (`score`);