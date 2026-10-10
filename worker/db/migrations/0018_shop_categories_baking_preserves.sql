-- Nové kategórie obchodu pre existujúce domácnosti: Pečenie hneď za Pečivom a Konzervy a zaváraniny hneď
-- za Trvanlivými (ak domácnosť tieto kategórie premenovala alebo nemá, pridajú sa na koniec).
UPDATE `shop_categories` SET `sort_order` = `sort_order` + 1
WHERE `household_id` NOT IN (SELECT `household_id` FROM `shop_categories` WHERE `name` = 'Pečenie')
  AND `sort_order` > COALESCE(
    (SELECT p.`sort_order` FROM `shop_categories` p WHERE p.`household_id` = `shop_categories`.`household_id` AND p.`name` = 'Pečivo'),
    1000000
  );--> statement-breakpoint
INSERT INTO `shop_categories` (`id`, `household_id`, `name`, `sort_order`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(13))), h.`id`, 'Pečenie',
  COALESCE(
    (SELECT p.`sort_order` + 1 FROM `shop_categories` p WHERE p.`household_id` = h.`id` AND p.`name` = 'Pečivo'),
    (SELECT COALESCE(MAX(c.`sort_order`), -1) + 1 FROM `shop_categories` c WHERE c.`household_id` = h.`id`)
  ),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `households` h
WHERE NOT EXISTS (SELECT 1 FROM `shop_categories` c WHERE c.`household_id` = h.`id` AND c.`name` = 'Pečenie');--> statement-breakpoint
UPDATE `shop_categories` SET `sort_order` = `sort_order` + 1
WHERE `household_id` NOT IN (SELECT `household_id` FROM `shop_categories` WHERE `name` = 'Konzervy a zaváraniny')
  AND `sort_order` > COALESCE(
    (SELECT p.`sort_order` FROM `shop_categories` p WHERE p.`household_id` = `shop_categories`.`household_id` AND p.`name` = 'Trvanlivé'),
    1000000
  );--> statement-breakpoint
INSERT INTO `shop_categories` (`id`, `household_id`, `name`, `sort_order`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(13))), h.`id`, 'Konzervy a zaváraniny',
  COALESCE(
    (SELECT p.`sort_order` + 1 FROM `shop_categories` p WHERE p.`household_id` = h.`id` AND p.`name` = 'Trvanlivé'),
    (SELECT COALESCE(MAX(c.`sort_order`), -1) + 1 FROM `shop_categories` c WHERE c.`household_id` = h.`id`)
  ),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `households` h
WHERE NOT EXISTS (SELECT 1 FROM `shop_categories` c WHERE c.`household_id` = h.`id` AND c.`name` = 'Konzervy a zaváraniny');
