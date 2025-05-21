PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`user_id` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_cases`("id", "name", "user_id", "status", "created_at") SELECT "id", "name", "user_id", "status", "created_at" FROM `cases`;--> statement-breakpoint
DROP TABLE `cases`;--> statement-breakpoint
ALTER TABLE `__new_cases` RENAME TO `cases`;--> statement-breakpoint
PRAGMA foreign_keys=ON;