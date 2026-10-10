CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_household_email_uq` ON `contacts` (`household_id`,`email`);--> statement-breakpoint
CREATE TABLE `recipe_share_items` (
	`share_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	PRIMARY KEY(`share_id`, `recipe_id`),
	FOREIGN KEY (`share_id`) REFERENCES `recipe_shares`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_share_items_recipe_idx` ON `recipe_share_items` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipe_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`from_household_id` text NOT NULL,
	`from_user_id` text,
	`to_email` text NOT NULL,
	`to_household_id` text,
	`kind` text NOT NULL,
	`category` text,
	`tag_id` text,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`responded_at` text,
	`seen_at` text,
	FOREIGN KEY (`from_household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_shares_to_email_idx` ON `recipe_shares` (`to_email`,`status`);--> statement-breakpoint
CREATE INDEX `recipe_shares_to_household_idx` ON `recipe_shares` (`to_household_id`,`status`);--> statement-breakpoint
CREATE INDEX `recipe_shares_from_household_idx` ON `recipe_shares` (`from_household_id`,`status`);--> statement-breakpoint
ALTER TABLE `recipes` ADD `copied_from_name` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `copied_source_updated_at` text;