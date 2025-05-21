ALTER TABLE `transactions` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `created_at` integer DEFAULT 1739169642369 NOT NULL;