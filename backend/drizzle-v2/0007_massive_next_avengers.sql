ALTER TABLE `payout_batches` DROP INDEX `payout_batch_idempotency_unique`;--> statement-breakpoint
ALTER TABLE `booking_financial_snapshots` ADD `gateway_fee_funding` varchar(20) DEFAULT 'OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE `commission_configs` ADD `gateway_fee_basis_points` int unsigned DEFAULT 250 NOT NULL;--> statement-breakpoint
ALTER TABLE `payout_batches` ADD CONSTRAINT `payout_batch_idempotency_unique` UNIQUE(`tenant_id`,`idempotency_key`);