CREATE TABLE `opportunity_to_earn` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`home_loan_value` real NOT NULL,
	`loan_against_property` real NOT NULL,
	`business_loan` real NOT NULL,
	`term_plan` real NOT NULL,
	`general_insurance` real NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE CASCADE
);
