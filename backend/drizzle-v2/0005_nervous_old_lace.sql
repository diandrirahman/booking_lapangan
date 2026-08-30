ALTER TABLE `payout_items` MODIFY COLUMN `amount` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_financial_snapshots` ADD `payment_mode` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_financial_snapshots` ADD `reservation_amount` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_financial_snapshots` ADD `dp_amount` bigint unsigned DEFAULT 0 NOT NULL;