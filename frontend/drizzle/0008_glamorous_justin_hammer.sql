PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_eod` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_eod`("id", "case_id", "data") SELECT "id", "case_id", "data" FROM `eod`;--> statement-breakpoint
DROP TABLE `eod`;--> statement-breakpoint
ALTER TABLE `__new_eod` RENAME TO `eod`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_statements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`account_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`ifsc_code` text,
	`bank_name` text,
	`file_path` text DEFAULT 'downloads' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_statements`("id", "case_id", "account_number", "customer_name", "ifsc_code", "bank_name", "file_path", "created_at") SELECT "id", "case_id", "account_number", "customer_name", "ifsc_code", "bank_name", "file_path", "created_at" FROM `statements`;--> statement-breakpoint
DROP TABLE `statements`;--> statement-breakpoint
ALTER TABLE `__new_statements` RENAME TO `statements`;--> statement-breakpoint
CREATE TABLE `__new_summary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_summary`("id", "case_id", "data") SELECT "id", "case_id", "data" FROM `summary`;--> statement-breakpoint
DROP TABLE `summary`;--> statement-breakpoint
ALTER TABLE `__new_summary` RENAME TO `summary`;