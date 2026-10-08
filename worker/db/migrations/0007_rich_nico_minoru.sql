CREATE INDEX `member_preferences_ingredient_idx` ON `member_preferences` (`ingredient_id`);--> statement-breakpoint
CREATE INDEX `pantry_items_household_ingredient_idx` ON `pantry_items` (`household_id`,`ingredient_id`);--> statement-breakpoint
CREATE INDEX `shopping_item_sources_recipe_ingredient_idx` ON `shopping_item_sources` (`recipe_ingredient_id`);--> statement-breakpoint
CREATE INDEX `staple_items_ingredient_idx` ON `staple_items` (`ingredient_id`);