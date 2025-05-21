ALTER TABLE `users` ADD `last_login` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_unique` ON `users` (`name`);