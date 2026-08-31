UPDATE `owner_earnings`
INNER JOIN `payout_items` ON `payout_items`.`earning_id` = `owner_earnings`.`id`
INNER JOIN `payout_batches` ON `payout_batches`.`id` = `payout_items`.`payout_batch_id`
SET `owner_earnings`.`status` = 'RESERVED_FOR_PAYOUT'
WHERE `payout_batches`.`status` = 'FAILED'
  AND `owner_earnings`.`status` = 'AVAILABLE';--> statement-breakpoint
ALTER TABLE `payout_items` ADD CONSTRAINT `payout_item_batch_earning_unique` UNIQUE(`earning_id`,`payout_batch_id`);--> statement-breakpoint
ALTER TABLE `payout_items` DROP INDEX `payout_item_earning_unique`;
