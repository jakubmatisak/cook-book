CREATE TABLE `recipe_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`image_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_attachments_recipe_idx` ON `recipe_attachments` (`recipe_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `recipe_attachments_image_idx` ON `recipe_attachments` (`image_id`);--> statement-breakpoint
ALTER TABLE `recipes` ADD `notes` text;