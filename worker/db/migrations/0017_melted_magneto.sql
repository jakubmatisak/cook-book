ALTER TABLE `recipe_shares` ADD `seen_recipe_ids` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `content_updated_at` text;--> statement-breakpoint
-- Doterajšie recepty: obsah sa naposledy zmenil pri poslednej úprave riadku.
UPDATE `recipes` SET `content_updated_at` = `updated_at` WHERE `content_updated_at` IS NULL;
