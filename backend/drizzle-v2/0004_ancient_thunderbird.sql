CREATE TABLE `cancellation_policy_templates` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_by_user_id` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `cancellation_policy_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cancellation_policy_tiers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`template_id` bigint unsigned NOT NULL,
	`minimum_hours_before` int unsigned NOT NULL,
	`maximum_hours_before` int unsigned,
	`refund_basis_points` int unsigned NOT NULL,
	CONSTRAINT `cancellation_policy_tiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venue_policy_assignments` (
	`venue_id` int unsigned NOT NULL,
	`template_id` bigint unsigned NOT NULL,
	CONSTRAINT `venue_policy_assignments_venue_id` PRIMARY KEY(`venue_id`)
);
--> statement-breakpoint
CREATE TABLE `promotion_redemptions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`promotion_id` int unsigned NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`discount_amount` bigint unsigned NOT NULL,
	`status` varchar(16) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `promotion_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `promotion_redemption_booking_unique` UNIQUE(`booking_id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`code` varchar(40) NOT NULL,
	`label` varchar(80) NOT NULL,
	CONSTRAINT `permissions_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` bigint unsigned NOT NULL,
	`permission_code` varchar(40) NOT NULL,
	CONSTRAINT `role_permissions_role_id_permission_code_pk` PRIMARY KEY(`role_id`,`permission_code`)
);
--> statement-breakpoint
CREATE TABLE `tenant_roles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned,
	`name` varchar(50) NOT NULL,
	`template_code` varchar(32),
	`immutable` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_roles_tenant_name_unique` UNIQUE(`tenant_id`,`name`),
	CONSTRAINT `tenant_roles_template_code_unique` UNIQUE(`template_code`)
);
--> statement-breakpoint
CREATE TABLE `booking_financial_snapshots` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`booking_version` int unsigned NOT NULL,
	`commission_config_id` bigint unsigned,
	`promotion_id` int unsigned,
	`court_subtotal` bigint unsigned NOT NULL,
	`addon_subtotal` bigint unsigned NOT NULL,
	`owner_discount` bigint unsigned NOT NULL DEFAULT 0,
	`platform_discount` bigint unsigned NOT NULL DEFAULT 0,
	`commission_base` bigint unsigned NOT NULL,
	`commission_rate_basis_points` int unsigned NOT NULL,
	`platform_commission` bigint unsigned NOT NULL,
	`gateway_fee` bigint unsigned NOT NULL DEFAULT 0,
	`owner_net` bigint NOT NULL,
	`tax_placeholder` bigint unsigned NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `booking_financial_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `financial_snapshot_booking_version_unique` UNIQUE(`booking_id`,`booking_version`)
);
--> statement-breakpoint
CREATE TABLE `commission_configs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned,
	`rate_basis_points` int unsigned NOT NULL,
	`effective_from` datetime NOT NULL,
	`effective_to` datetime,
	`trial_days` int unsigned,
	`trial_completed_booking_limit` int unsigned,
	`gateway_fee_funding` varchar(20) NOT NULL DEFAULT 'OWNER',
	`subsidy_budget` bigint unsigned,
	`subsidy_used` bigint unsigned NOT NULL DEFAULT 0,
	`reason` text NOT NULL,
	`created_by_user_id` bigint unsigned,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `commission_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`transaction_id` bigint unsigned NOT NULL,
	`account_code` varchar(40) NOT NULL,
	`debit` bigint unsigned NOT NULL DEFAULT 0,
	`credit` bigint unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `ledger_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ledger_transactions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned,
	`booking_id` bigint unsigned,
	`kind` varchar(32) NOT NULL,
	`idempotency_key` varchar(120) NOT NULL,
	`description` varchar(180) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ledger_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ledger_transaction_idempotency_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `owner_earnings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`snapshot_id` bigint unsigned NOT NULL,
	`source_key` varchar(100) NOT NULL,
	`amount` bigint NOT NULL,
	`status` varchar(24) NOT NULL,
	`available_at` datetime(3),
	`frozen_by_support_ticket_id` bigint unsigned,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `owner_earnings_id` PRIMARY KEY(`id`),
	CONSTRAINT `owner_earning_source_unique` UNIQUE(`source_key`)
);
--> statement-breakpoint
CREATE TABLE `payout_batches` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned NOT NULL,
	`status` varchar(20) NOT NULL,
	`kind` varchar(12) NOT NULL,
	`total_amount` bigint unsigned NOT NULL,
	`idempotency_key` varchar(100) NOT NULL,
	`requested_by_user_id` bigint unsigned,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `payout_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `payout_batch_idempotency_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `payout_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`payout_batch_id` bigint unsigned NOT NULL,
	`earning_id` bigint unsigned NOT NULL,
	`amount` bigint unsigned NOT NULL,
	CONSTRAINT `payout_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `payout_item_earning_unique` UNIQUE(`earning_id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_finance_settings` (
	`tenant_id` int unsigned NOT NULL,
	`minimum_payout_amount` bigint unsigned NOT NULL DEFAULT 100000,
	`manual_payout_enabled` boolean NOT NULL DEFAULT true,
	`payout_account_label` varchar(80),
	`payout_account_last4` varchar(4),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `tenant_finance_settings_tenant_id` PRIMARY KEY(`tenant_id`)
);
--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`event_id` varchar(100) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`channel` varchar(12) NOT NULL,
	`status` varchar(16) NOT NULL,
	`subject` varchar(120) NOT NULL,
	`body` text NOT NULL,
	`action_path` varchar(180),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `notification_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_delivery_event_unique` UNIQUE(`event_id`,`user_id`,`channel`)
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`user_id` bigint unsigned NOT NULL,
	`event_type` varchar(60) NOT NULL,
	`channel` varchar(12) NOT NULL,
	`enabled` int unsigned NOT NULL DEFAULT 1,
	CONSTRAINT `notification_preferences_user_id_event_type_channel_pk` PRIMARY KEY(`user_id`,`event_type`,`channel`)
);
--> statement-breakpoint
CREATE TABLE `notification_reminder_options` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`minutes_before` int unsigned NOT NULL,
	`active` int unsigned NOT NULL DEFAULT 1,
	CONSTRAINT `notification_reminder_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_reminder_minutes_unique` UNIQUE(`minutes_before`)
);
--> statement-breakpoint
CREATE TABLE `venue_reminder_settings` (
	`venue_id` int unsigned NOT NULL,
	`reminder_option_id` bigint unsigned NOT NULL,
	CONSTRAINT `venue_reminder_settings_venue_id_reminder_option_id_pk` PRIMARY KEY(`venue_id`,`reminder_option_id`)
);
--> statement-breakpoint
CREATE TABLE `review_replies` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`review_id` bigint unsigned NOT NULL,
	`author_user_id` bigint unsigned NOT NULL,
	`body` text NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `review_replies_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_replies_review_id_unique` UNIQUE(`review_id`)
);
--> statement-breakpoint
CREATE TABLE `review_reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`review_id` bigint unsigned NOT NULL,
	`reporter_user_id` bigint unsigned NOT NULL,
	`reason` text NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'OPEN',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `review_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_reporter_unique` UNIQUE(`review_id`,`reporter_user_id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`customer_user_id` bigint unsigned NOT NULL,
	`rating` tinyint unsigned NOT NULL,
	`cleanliness` tinyint unsigned NOT NULL,
	`court_quality` tinyint unsigned NOT NULL,
	`facility` tinyint unsigned NOT NULL,
	`service` tinyint unsigned NOT NULL,
	`value` tinyint unsigned NOT NULL,
	`comment` text NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'VISIBLE',
	`edited_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_booking_unique` UNIQUE(`booking_id`)
);
--> statement-breakpoint
CREATE TABLE `support_ticket_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ticket_id` bigint unsigned NOT NULL,
	`author_user_id` bigint unsigned NOT NULL,
	`body` text NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `support_ticket_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ticket_code` varchar(20) NOT NULL,
	`customer_user_id` bigint unsigned,
	`tenant_id` int unsigned,
	`venue_id` int unsigned,
	`booking_id` bigint unsigned,
	`payment_attempt_id` bigint unsigned,
	`refund_id` bigint unsigned,
	`category` varchar(32) NOT NULL,
	`subject` varchar(120) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'OPEN',
	`transaction_dispute` boolean NOT NULL DEFAULT false,
	`assigned_admin_user_id` bigint unsigned,
	`resolution` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `support_ticket_code_unique` UNIQUE(`ticket_code`)
);
--> statement-breakpoint
ALTER TABLE `booking_cancellations` ADD `refund_basis_points` int unsigned;--> statement-breakpoint
ALTER TABLE `booking_cancellations` ADD `refundable_amount` bigint unsigned;--> statement-breakpoint
ALTER TABLE `booking_cancellations` ADD `decision` varchar(20);--> statement-breakpoint
ALTER TABLE `booking_reschedules` ADD `status` varchar(20) DEFAULT 'COMPLETED' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_reschedules` ADD `price_difference` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_reschedules` ADD `policy_snapshot` json;--> statement-breakpoint
ALTER TABLE `booking_reschedules` ADD `expires_at` datetime(3);--> statement-breakpoint
ALTER TABLE `booking_reschedules` ADD `finalized_at` datetime(3);--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancellation_policy_snapshot` json;--> statement-breakpoint
ALTER TABLE `promotions` ADD `code` varchar(32);--> statement-breakpoint
ALTER TABLE `promotions` ADD `starts_at_time` time;--> statement-breakpoint
ALTER TABLE `promotions` ADD `ends_at_time` time;--> statement-breakpoint
ALTER TABLE `promotions` ADD `discount_type` varchar(12);--> statement-breakpoint
ALTER TABLE `promotions` ADD `discount_value` bigint unsigned;--> statement-breakpoint
ALTER TABLE `promotions` ADD `minimum_amount` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `maximum_discount` bigint unsigned;--> statement-breakpoint
ALTER TABLE `promotions` ADD `quota` int unsigned;--> statement-breakpoint
ALTER TABLE `promotions` ADD `quota_used` int unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `per_user_limit` int unsigned DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `first_booking_only` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `payment_method` varchar(20);--> statement-breakpoint
ALTER TABLE `promotions` ADD `funding_source` varchar(16);--> statement-breakpoint
ALTER TABLE `promotions` ADD `budget_amount` bigint unsigned;--> statement-breakpoint
ALTER TABLE `promotions` ADD `budget_used` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD `tenant_role_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `refunds` ADD `decision_status` varchar(20) DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE `refunds` ADD `decided_by_user_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `refunds` ADD `decided_at` datetime(3);--> statement-breakpoint
ALTER TABLE `refunds` ADD `execution_attempts` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `refunds` ADD `failure_reason` text;--> statement-breakpoint
ALTER TABLE `outbox_events` ADD `audience_user_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `user_notifications` ADD `event_id` varchar(100);--> statement-breakpoint
ALTER TABLE `user_notifications` ADD `critical` int unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_reschedules` ADD CONSTRAINT `booking_reschedule_once_unique` UNIQUE(`booking_id`);--> statement-breakpoint
ALTER TABLE `promotions` ADD CONSTRAINT `promotions_code_unique` UNIQUE(`code`);--> statement-breakpoint
ALTER TABLE `user_notifications` ADD CONSTRAINT `user_notifications_event_unique` UNIQUE(`user_id`,`event_id`);--> statement-breakpoint
ALTER TABLE `cancellation_policy_templates` ADD CONSTRAINT `cancellation_policy_templates_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cancellation_policy_tiers` ADD CONSTRAINT `cancel_policy_tier_template_fk` FOREIGN KEY (`template_id`) REFERENCES `cancellation_policy_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_policy_assignments` ADD CONSTRAINT `venue_policy_assignments_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_policy_assignments` ADD CONSTRAINT `venue_policy_template_fk` FOREIGN KEY (`template_id`) REFERENCES `cancellation_policy_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotion_redemptions` ADD CONSTRAINT `promotion_redemptions_promotion_id_promotions_id_fk` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotion_redemptions` ADD CONSTRAINT `promotion_redemptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_tenant_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `tenant_roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_code_permissions_code_fk` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_roles` ADD CONSTRAINT `tenant_roles_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_financial_snapshots` ADD CONSTRAINT `booking_financial_snapshots_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_financial_snapshots` ADD CONSTRAINT `financial_snapshot_commission_fk` FOREIGN KEY (`commission_config_id`) REFERENCES `commission_configs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_financial_snapshots` ADD CONSTRAINT `booking_financial_snapshots_promotion_id_promotions_id_fk` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commission_configs` ADD CONSTRAINT `commission_configs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commission_configs` ADD CONSTRAINT `commission_configs_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_transaction_id_ledger_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `ledger_transactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_transactions` ADD CONSTRAINT `ledger_transactions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_transactions` ADD CONSTRAINT `ledger_transactions_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `owner_earnings` ADD CONSTRAINT `owner_earnings_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `owner_earnings` ADD CONSTRAINT `owner_earnings_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `owner_earnings` ADD CONSTRAINT `owner_earnings_snapshot_id_booking_financial_snapshots_id_fk` FOREIGN KEY (`snapshot_id`) REFERENCES `booking_financial_snapshots`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payout_batches` ADD CONSTRAINT `payout_batches_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payout_batches` ADD CONSTRAINT `payout_batches_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payout_items` ADD CONSTRAINT `payout_items_payout_batch_id_payout_batches_id_fk` FOREIGN KEY (`payout_batch_id`) REFERENCES `payout_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payout_items` ADD CONSTRAINT `payout_items_earning_id_owner_earnings_id_fk` FOREIGN KEY (`earning_id`) REFERENCES `owner_earnings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_finance_settings` ADD CONSTRAINT `tenant_finance_settings_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_deliveries` ADD CONSTRAINT `notification_deliveries_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_reminder_settings` ADD CONSTRAINT `venue_reminder_option_fk` FOREIGN KEY (`reminder_option_id`) REFERENCES `notification_reminder_options`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_replies` ADD CONSTRAINT `review_replies_review_id_reviews_id_fk` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_replies` ADD CONSTRAINT `review_replies_author_user_id_users_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_reports` ADD CONSTRAINT `review_reports_review_id_reviews_id_fk` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_reports` ADD CONSTRAINT `review_reports_reporter_user_id_users_id_fk` FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_customer_user_id_users_id_fk` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_ticket_messages` ADD CONSTRAINT `support_ticket_messages_ticket_id_support_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_ticket_messages` ADD CONSTRAINT `support_ticket_messages_author_user_id_users_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_customer_user_id_users_id_fk` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_payment_attempt_id_payment_attempts_id_fk` FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_refund_id_refunds_id_fk` FOREIGN KEY (`refund_id`) REFERENCES `refunds`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_assigned_admin_user_id_users_id_fk` FOREIGN KEY (`assigned_admin_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cancellation_policy_tier_idx` ON `cancellation_policy_tiers` (`template_id`);--> statement-breakpoint
CREATE INDEX `promotion_redemption_user_idx` ON `promotion_redemptions` (`promotion_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `commission_config_effective_idx` ON `commission_configs` (`tenant_id`,`effective_from`);--> statement-breakpoint
CREATE INDEX `ledger_entries_transaction_idx` ON `ledger_entries` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `owner_earning_booking_idx` ON `owner_earnings` (`booking_id`);--> statement-breakpoint
CREATE INDEX `owner_earning_payout_idx` ON `owner_earnings` (`tenant_id`,`status`,`available_at`);--> statement-breakpoint
CREATE INDEX `payout_batch_tenant_status_idx` ON `payout_batches` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `review_venue_status_idx` ON `reviews` (`venue_id`,`status`);--> statement-breakpoint
CREATE INDEX `support_ticket_scope_idx` ON `support_tickets` (`tenant_id`,`status`);--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_tenant_role_id_tenant_roles_id_fk` FOREIGN KEY (`tenant_role_id`) REFERENCES `tenant_roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_decided_by_user_id_users_id_fk` FOREIGN KEY (`decided_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `outbox_events` ADD CONSTRAINT `outbox_events_audience_user_id_users_id_fk` FOREIGN KEY (`audience_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
