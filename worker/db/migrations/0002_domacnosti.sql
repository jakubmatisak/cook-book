CREATE TABLE `household_members` (
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `household_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `household_members_household_idx` ON `household_members` (`household_id`);--> statement-breakpoint
-- Doterajšie účty: členstvo vo svojej domácnosti; najstarší účet domácnosti je vlastník, ostatní členovia.
INSERT INTO `household_members` (`user_id`, `household_id`, `role`, `created_at`)
SELECT `u`.`id`, `u`.`household_id`,
  CASE WHEN `u`.`id` = (
    SELECT `u2`.`id` FROM `users` `u2` WHERE `u2`.`household_id` = `u`.`household_id` ORDER BY `u2`.`created_at`, `u2`.`id` LIMIT 1
  ) THEN 'owner' ELSE 'member' END,
  `u`.`created_at`
FROM `users` `u`;
