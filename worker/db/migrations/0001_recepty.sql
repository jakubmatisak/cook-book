DROP INDEX `ingredients_household_name_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_household_name_uq` ON `ingredients` (`household_id`,`name_normalized`);--> statement-breakpoint
DROP INDEX `recipe_steps_recipe_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_steps_recipe_position_uq` ON `recipe_steps` (`recipe_id`,`position`);--> statement-breakpoint
ALTER TABLE `recipes` ADD `title_normalized` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_household_slug_uq` ON `recipes` (`household_id`,`slug`);--> statement-breakpoint
CREATE INDEX `recipe_tags_tag_idx` ON `recipe_tags` (`tag_id`);