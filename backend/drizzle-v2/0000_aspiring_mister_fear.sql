CREATE TABLE `attendance_records` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'PENDING',
	`checked_in_at` datetime,
	`marked_by_user_id` bigint unsigned,
	`reason` text,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_addon_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`addon_id` int unsigned NOT NULL,
	`name_snapshot` varchar(60) NOT NULL,
	`unit_price` bigint unsigned NOT NULL,
	`quantity` smallint unsigned NOT NULL DEFAULT 1,
	`total_price` bigint unsigned NOT NULL,
	CONSTRAINT `booking_addon_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_cancellations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`actor_user_id` bigint unsigned,
	`reason` text NOT NULL,
	`kind` varchar(24) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `booking_cancellations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`court_id` int unsigned NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`subtotal` bigint unsigned NOT NULL,
	CONSTRAINT `booking_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_price_lines` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`line_type` varchar(20) NOT NULL,
	`reference_id` bigint unsigned,
	`label` varchar(100) NOT NULL,
	`quantity` smallint unsigned NOT NULL DEFAULT 1,
	`unit_amount` bigint unsigned NOT NULL,
	`total_amount` bigint unsigned NOT NULL,
	`rule_snapshot` json,
	CONSTRAINT `booking_price_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_qr_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `booking_qr_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_qr_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `booking_reschedules` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`previous_slot_ids` json NOT NULL,
	`new_slot_ids` json NOT NULL,
	`reason` text NOT NULL,
	`actor_user_id` bigint unsigned,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `booking_reschedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_slot_history` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`court_slot_id` bigint unsigned NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`action` varchar(20) NOT NULL,
	`reason` varchar(255),
	`occurred_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `booking_slot_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_slot_reservations` (
	`court_slot_id` bigint unsigned NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`booking_item_id` bigint unsigned NOT NULL,
	`reservation_status` varchar(20) NOT NULL,
	`expires_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `booking_slot_reservations_court_slot_id` PRIMARY KEY(`court_slot_id`)
);
--> statement-breakpoint
CREATE TABLE `booking_state_transitions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`from_status` varchar(24),
	`to_status` varchar(24) NOT NULL,
	`actor_user_id` bigint unsigned,
	`reason` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `booking_state_transitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_code` varchar(20) NOT NULL,
	`tenant_id` int unsigned NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`customer_user_id` bigint unsigned,
	`source` varchar(12) NOT NULL,
	`status` varchar(24) NOT NULL,
	`payment_mode` varchar(20) NOT NULL,
	`total_amount` bigint unsigned NOT NULL,
	`balance_due` bigint unsigned NOT NULL,
	`hold_expires_at` datetime,
	`confirmation_expires_at` datetime,
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_by_user_id` bigint unsigned NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_code_unique` UNIQUE(`booking_code`)
);
--> statement-breakpoint
CREATE TABLE `offline_booking_details` (
	`booking_id` bigint unsigned NOT NULL,
	`customer_name` varchar(50) NOT NULL,
	`customer_phone` varchar(16),
	`channel` varchar(20) NOT NULL,
	`original_amount` bigint unsigned NOT NULL,
	`adjusted_amount` bigint unsigned,
	`adjustment_reason` text,
	CONSTRAINT `offline_booking_details_booking_id` PRIMARY KEY(`booking_id`)
);
--> statement-breakpoint
CREATE TABLE `addon_courts` (
	`addon_id` int unsigned NOT NULL,
	`court_id` int unsigned NOT NULL,
	CONSTRAINT `addon_courts_addon_id_court_id_pk` PRIMARY KEY(`addon_id`,`court_id`)
);
--> statement-breakpoint
CREATE TABLE `addons` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`name` varchar(60) NOT NULL,
	`price` bigint unsigned NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `addons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courts` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`sport_id` smallint unsigned NOT NULL,
	`name` varchar(50) NOT NULL,
	`surface` varchar(50),
	`capacity` smallint unsigned,
	`status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `courts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` smallint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(50) NOT NULL,
	`name` varchar(50) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `facilities_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`owner_user_id` bigint unsigned,
	`storage_key` varchar(255) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`byte_size` bigint unsigned NOT NULL,
	`visibility` varchar(16) NOT NULL,
	`alt_text` varchar(150),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotion_scopes` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`promotion_id` int unsigned NOT NULL,
	`scope_type` varchar(20) NOT NULL,
	`scope_reference_id` bigint unsigned,
	`include_exclude` varchar(8) NOT NULL DEFAULT 'INCLUDE',
	CONSTRAINT `promotion_scopes_id` PRIMARY KEY(`id`),
	CONSTRAINT `promotion_scope_unique` UNIQUE(`promotion_id`,`scope_type`,`scope_reference_id`)
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned,
	`name` varchar(80) NOT NULL,
	`description` text,
	`status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`discovery_only` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sports` (
	`id` smallint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(40) NOT NULL,
	`name` varchar(40) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sports_id` PRIMARY KEY(`id`),
	CONSTRAINT `sports_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `venue_facilities` (
	`venue_id` int unsigned NOT NULL,
	`facility_id` smallint unsigned NOT NULL,
	CONSTRAINT `venue_facilities_venue_id_facility_id_pk` PRIMARY KEY(`venue_id`,`facility_id`)
);
--> statement-breakpoint
CREATE TABLE `venue_media` (
	`venue_id` int unsigned NOT NULL,
	`media_asset_id` int unsigned NOT NULL,
	`purpose` varchar(20) NOT NULL,
	`sort_order` smallint unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `venue_media_venue_id_media_asset_id_pk` PRIMARY KEY(`venue_id`,`media_asset_id`)
);
--> statement-breakpoint
CREATE TABLE `venue_publication_requests` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`venue_version` int unsigned NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'SUBMITTED',
	`submitted_snapshot` text NOT NULL,
	`reason` text,
	`submitted_by_user_id` bigint unsigned NOT NULL,
	`decided_by_user_id` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`decided_at` datetime,
	CONSTRAINT `venue_publication_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venue_search_metrics` (
	`venue_id` int unsigned NOT NULL,
	`rating_average` decimal(3,2) NOT NULL DEFAULT '0',
	`review_count` int unsigned NOT NULL DEFAULT 0,
	`popularity_score` int unsigned NOT NULL DEFAULT 0,
	`nearest_slot_starts_at` datetime,
	`minimum_price` bigint unsigned NOT NULL DEFAULT 0,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `venue_search_metrics_venue_id` PRIMARY KEY(`venue_id`)
);
--> statement-breakpoint
CREATE TABLE `venue_sports` (
	`venue_id` int unsigned NOT NULL,
	`sport_id` smallint unsigned NOT NULL,
	CONSTRAINT `venue_sports_venue_id_sport_id_pk` PRIMARY KEY(`venue_id`,`sport_id`)
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned NOT NULL,
	`name` varchar(80) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`publication_status` varchar(20) NOT NULL DEFAULT 'PRIVATE',
	`phone_e164` varchar(16),
	`email` varchar(254),
	`address_line` varchar(255) NOT NULL,
	`province_code` varchar(10),
	`city_code` varchar(10),
	`district_code` varchar(10),
	`postal_code` varchar(5),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`timezone` varchar(40) NOT NULL DEFAULT 'Asia/Jakarta',
	`indoor_outdoor_type` varchar(16) NOT NULL,
	`parking_info` varchar(255),
	`house_rules` text,
	`emergency_contact` varchar(50),
	`version` int unsigned NOT NULL DEFAULT 1,
	`published_at` datetime,
	`suspended_at` datetime,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `venues_id` PRIMARY KEY(`id`),
	CONSTRAINT `venues_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned,
	`venue_id` int unsigned,
	`actor_user_id` bigint unsigned,
	`action` varchar(64) NOT NULL,
	`resource_type` varchar(32) NOT NULL,
	`resource_id` bigint unsigned,
	`reason` text,
	`before_state` json,
	`after_state` json,
	`request_id` varchar(40),
	`ip_address` varchar(45),
	`user_agent` varchar(255),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_identities` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`provider` varchar(20) NOT NULL,
	`provider_subject` varchar(191) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `auth_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_provider_subject_unique` UNIQUE(`provider`,`provider_subject`),
	CONSTRAINT `auth_user_provider_unique` UNIQUE(`user_id`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `member_venue_assignments` (
	`membership_id` bigint unsigned NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `member_venue_assignments_membership_id_venue_id_pk` PRIMARY KEY(`membership_id`,`venue_id`)
);
--> statement-breakpoint
CREATE TABLE `owner_verification_cases` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`submitted_snapshot` json,
	`reason` text,
	`version` int unsigned NOT NULL,
	`submitted_at` datetime,
	`decided_at` datetime,
	`decided_by_user_id` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `owner_verification_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_admins` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `platform_admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_admin_user_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_memberships` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`role` varchar(20) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `memberships_tenant_user_unique` UNIQUE(`tenant_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'DRAFT',
	`primary_owner_membership_id` bigint unsigned,
	`suspended_at` datetime,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`email` varchar(254) NOT NULL,
	`phone_e164` varchar(16),
	`password_hash` varchar(255),
	`status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
	`email_verified_at` datetime,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification_documents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`case_id` int unsigned NOT NULL,
	`media_asset_id` int unsigned NOT NULL,
	`document_type` varchar(32) NOT NULL,
	`simulated` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `verification_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_payment_summaries` (
	`booking_id` bigint unsigned NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'UNPAID',
	`total_paid` bigint unsigned NOT NULL DEFAULT 0,
	`total_refunded` bigint unsigned NOT NULL DEFAULT 0,
	`balance_due` bigint unsigned NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `booking_payment_summaries_booking_id` PRIMARY KEY(`booking_id`)
);
--> statement-breakpoint
CREATE TABLE `payment_attempts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`kind` varchar(20) NOT NULL,
	`amount` bigint unsigned NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'CREATED',
	`provider` varchar(20) NOT NULL DEFAULT 'MIDTRANS',
	`provider_reference` varchar(100),
	`redirect_url` varchar(2048),
	`idempotency_key` varchar(100) NOT NULL,
	`expires_at` datetime(3),
	`paid_at` datetime(3),
	`sandbox` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `payment_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_attempt_idempotency_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `payment_provider_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`provider_event_id` varchar(100) NOT NULL,
	`payment_attempt_id` bigint unsigned,
	`signature_verified` boolean NOT NULL,
	`payload` json NOT NULL,
	`processed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `payment_provider_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_provider_event_unique` UNIQUE(`provider_event_id`)
);
--> statement-breakpoint
CREATE TABLE `refund_state_transitions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`refund_id` bigint unsigned NOT NULL,
	`from_status` varchar(20),
	`to_status` varchar(20) NOT NULL,
	`payload` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `refund_state_transitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`booking_id` bigint unsigned NOT NULL,
	`payment_attempt_id` bigint unsigned,
	`amount` bigint unsigned NOT NULL,
	`status` varchar(20) NOT NULL,
	`kind` varchar(24) NOT NULL,
	`reason` text NOT NULL,
	`idempotency_key` varchar(100) NOT NULL,
	`requested_by_user_id` bigint unsigned,
	`provider_reference` varchar(100),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `refund_idempotency_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `command_idempotency` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`scope` varchar(50) NOT NULL,
	`idempotency_key` varchar(100) NOT NULL,
	`actor_user_id` bigint unsigned NOT NULL,
	`resource_id` bigint unsigned,
	`response_status` smallint unsigned,
	`response_body` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `command_idempotency_id` PRIMARY KEY(`id`),
	CONSTRAINT `command_idempotency_unique` UNIQUE(`scope`,`actor_user_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `inbox_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`source` varchar(40) NOT NULL,
	`external_event_id` varchar(100) NOT NULL,
	`payload` json NOT NULL,
	`processed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `inbox_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `inbox_source_event_unique` UNIQUE(`source`,`external_event_id`)
);
--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`tenant_id` int unsigned,
	`event_type` varchar(80) NOT NULL,
	`resource_type` varchar(40) NOT NULL,
	`resource_id` bigint unsigned NOT NULL,
	`resource_version` int unsigned NOT NULL,
	`payload` json NOT NULL,
	`occurred_at` datetime(3) NOT NULL,
	`processed_at` datetime(3),
	`attempt_count` smallint unsigned NOT NULL DEFAULT 0,
	`last_error` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `outbox_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_buffer_options` (
	`id` smallint unsigned AUTO_INCREMENT NOT NULL,
	`minutes` smallint unsigned NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `booking_buffer_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_buffer_minutes_unique` UNIQUE(`minutes`)
);
--> statement-breakpoint
CREATE TABLE `booking_interval_options` (
	`id` smallint unsigned AUTO_INCREMENT NOT NULL,
	`minutes` smallint unsigned NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `booking_interval_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_interval_minutes_unique` UNIQUE(`minutes`)
);
--> statement-breakpoint
CREATE TABLE `court_blocks` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`court_id` int unsigned,
	`kind` varchar(20) NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`reason` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `court_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `court_booking_settings` (
	`court_id` int unsigned NOT NULL,
	`interval_minutes` smallint unsigned NOT NULL DEFAULT 60,
	`buffer_minutes` smallint unsigned NOT NULL DEFAULT 0,
	`minimum_duration_minutes` smallint unsigned NOT NULL DEFAULT 60,
	`maximum_duration_minutes` smallint unsigned NOT NULL DEFAULT 180,
	`booking_window_days` smallint unsigned NOT NULL DEFAULT 30,
	`minimum_lead_minutes` int unsigned NOT NULL DEFAULT 60,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `court_booking_settings_court_id` PRIMARY KEY(`court_id`)
);
--> statement-breakpoint
CREATE TABLE `court_slots` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`court_id` int unsigned NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'OPEN',
	`version` int unsigned NOT NULL DEFAULT 1,
	CONSTRAINT `court_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `court_slot_range_unique` UNIQUE(`court_id`,`starts_at`,`ends_at`)
);
--> statement-breakpoint
CREATE TABLE `court_weekly_schedules` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`court_id` int unsigned NOT NULL,
	`day_of_week` tinyint unsigned NOT NULL,
	`opens_at` time NOT NULL,
	`closes_at` time NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `court_weekly_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `court_weekly_range_unique` UNIQUE(`court_id`,`day_of_week`,`opens_at`,`closes_at`)
);
--> statement-breakpoint
CREATE TABLE `payment_method_options` (
	`id` smallint unsigned AUTO_INCREMENT NOT NULL,
	`code` varchar(24) NOT NULL,
	`label` varchar(50) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `payment_method_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_method_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `price_rules` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`court_id` int unsigned,
	`kind` varchar(20) NOT NULL,
	`priority` smallint unsigned NOT NULL,
	`day_of_week` tinyint unsigned,
	`special_date` date,
	`starts_at_local` time,
	`ends_at_local` time,
	`amount` bigint unsigned NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`valid_from` datetime,
	`valid_until` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `price_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_exceptions` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`court_id` int unsigned,
	`local_date` date NOT NULL,
	`kind` varchar(20) NOT NULL,
	`opens_at` time,
	`closes_at` time,
	`reason` varchar(255),
	CONSTRAINT `schedule_exceptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venue_operating_hours` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`venue_id` int unsigned NOT NULL,
	`day_of_week` tinyint unsigned NOT NULL,
	`opens_at` time,
	`closes_at` time,
	`closed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `venue_operating_hours_id` PRIMARY KEY(`id`),
	CONSTRAINT `venue_operating_day_unique` UNIQUE(`venue_id`,`day_of_week`)
);
--> statement-breakpoint
CREATE TABLE `venue_payment_settings` (
	`venue_id` int unsigned NOT NULL,
	`allow_full` boolean NOT NULL DEFAULT true,
	`allow_dp` boolean NOT NULL DEFAULT false,
	`dp_percentage` tinyint unsigned,
	`allow_pay_at_venue` boolean NOT NULL DEFAULT false,
	`reservation_amount` bigint unsigned,
	`manual_confirmation_minutes` smallint unsigned NOT NULL DEFAULT 30,
	`balance_deadline_minutes` int unsigned,
	CONSTRAINT `venue_payment_settings_venue_id` PRIMARY KEY(`venue_id`)
);
--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_marked_by_user_id_users_id_fk` FOREIGN KEY (`marked_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_addon_items` ADD CONSTRAINT `booking_addon_items_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_addon_items` ADD CONSTRAINT `booking_addon_items_addon_id_addons_id_fk` FOREIGN KEY (`addon_id`) REFERENCES `addons`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_cancellations` ADD CONSTRAINT `booking_cancellations_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_cancellations` ADD CONSTRAINT `booking_cancellations_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_court_id_courts_id_fk` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_price_lines` ADD CONSTRAINT `booking_price_lines_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_qr_tokens` ADD CONSTRAINT `booking_qr_tokens_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_reschedules` ADD CONSTRAINT `booking_reschedules_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_reschedules` ADD CONSTRAINT `booking_reschedules_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_slot_history` ADD CONSTRAINT `booking_slot_history_court_slot_id_court_slots_id_fk` FOREIGN KEY (`court_slot_id`) REFERENCES `court_slots`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_slot_history` ADD CONSTRAINT `booking_slot_history_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_slot_reservations` ADD CONSTRAINT `booking_slot_reservations_court_slot_id_court_slots_id_fk` FOREIGN KEY (`court_slot_id`) REFERENCES `court_slots`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_slot_reservations` ADD CONSTRAINT `booking_slot_reservations_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_slot_reservations` ADD CONSTRAINT `booking_slot_reservations_booking_item_id_booking_items_id_fk` FOREIGN KEY (`booking_item_id`) REFERENCES `booking_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_state_transitions` ADD CONSTRAINT `booking_state_transitions_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_state_transitions` ADD CONSTRAINT `booking_state_transitions_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customer_user_id_users_id_fk` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offline_booking_details` ADD CONSTRAINT `offline_booking_details_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `addon_courts` ADD CONSTRAINT `addon_courts_addon_id_addons_id_fk` FOREIGN KEY (`addon_id`) REFERENCES `addons`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `addon_courts` ADD CONSTRAINT `addon_courts_court_id_courts_id_fk` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `addons` ADD CONSTRAINT `addons_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courts` ADD CONSTRAINT `courts_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courts` ADD CONSTRAINT `courts_sport_id_sports_id_fk` FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotion_scopes` ADD CONSTRAINT `promotion_scopes_promotion_id_promotions_id_fk` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotions` ADD CONSTRAINT `promotions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_facilities` ADD CONSTRAINT `venue_facilities_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_facilities` ADD CONSTRAINT `venue_facilities_facility_id_facilities_id_fk` FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_media` ADD CONSTRAINT `venue_media_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_media` ADD CONSTRAINT `venue_media_media_asset_id_media_assets_id_fk` FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_publication_requests` ADD CONSTRAINT `venue_publication_requests_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_publication_requests` ADD CONSTRAINT `venue_publication_requests_submitted_by_user_id_users_id_fk` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_publication_requests` ADD CONSTRAINT `venue_publication_requests_decided_by_user_id_users_id_fk` FOREIGN KEY (`decided_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_search_metrics` ADD CONSTRAINT `venue_search_metrics_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_sports` ADD CONSTRAINT `venue_sports_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_sports` ADD CONSTRAINT `venue_sports_sport_id_sports_id_fk` FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venues` ADD CONSTRAINT `venues_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_identities` ADD CONSTRAINT `auth_identities_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_venue_assignments` ADD CONSTRAINT `member_venue_assignments_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `owner_verification_cases` ADD CONSTRAINT `owner_verification_cases_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `owner_verification_cases` ADD CONSTRAINT `owner_verification_cases_decided_by_user_id_users_id_fk` FOREIGN KEY (`decided_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_admins` ADD CONSTRAINT `platform_admins_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_documents` ADD CONSTRAINT `verification_documents_case_id_owner_verification_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `owner_verification_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_payment_summaries` ADD CONSTRAINT `booking_payment_summaries_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempts_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_provider_events` ADD CONSTRAINT `payment_provider_events_attempt_fk` FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund_state_transitions` ADD CONSTRAINT `refund_state_transitions_refund_id_refunds_id_fk` FOREIGN KEY (`refund_id`) REFERENCES `refunds`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_attempt_id_payment_attempts_id_fk` FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `command_idempotency` ADD CONSTRAINT `command_idempotency_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `outbox_events` ADD CONSTRAINT `outbox_events_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `court_blocks` ADD CONSTRAINT `court_blocks_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `court_blocks` ADD CONSTRAINT `court_blocks_court_id_courts_id_fk` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `court_booking_settings` ADD CONSTRAINT `court_booking_settings_court_id_courts_id_fk` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `court_slots` ADD CONSTRAINT `court_slots_court_id_courts_id_fk` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `court_weekly_schedules` ADD CONSTRAINT `court_weekly_schedules_court_id_courts_id_fk` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_rules` ADD CONSTRAINT `price_rules_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_rules` ADD CONSTRAINT `price_rules_court_id_courts_id_fk` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_exceptions` ADD CONSTRAINT `schedule_exceptions_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_exceptions` ADD CONSTRAINT `schedule_exceptions_court_id_courts_id_fk` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_operating_hours` ADD CONSTRAINT `venue_operating_hours_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `venue_payment_settings` ADD CONSTRAINT `venue_payment_settings_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `booking_slot_history_idx` ON `booking_slot_history` (`booking_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `booking_transition_idx` ON `booking_state_transitions` (`booking_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `booking_tenant_status_idx` ON `bookings` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `booking_customer_created_idx` ON `bookings` (`customer_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `booking_hold_expiry_idx` ON `bookings` (`hold_expires_at`,`status`);--> statement-breakpoint
CREATE INDEX `courts_venue_status_idx` ON `courts` (`venue_id`,`status`);--> statement-breakpoint
CREATE INDEX `promotions_discovery_idx` ON `promotions` (`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `publication_status_idx` ON `venue_publication_requests` (`status`);--> statement-breakpoint
CREATE INDEX `venues_tenant_status_idx` ON `venues` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `venues_city_publication_idx` ON `venues` (`city_code`,`publication_status`);--> statement-breakpoint
CREATE INDEX `audit_tenant_created_idx` ON `audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_resource_idx` ON `audit_logs` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `owner_verification_status_idx` ON `owner_verification_cases` (`status`);--> statement-breakpoint
CREATE INDEX `memberships_user_status_idx` ON `tenant_memberships` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `payment_booking_created_idx` ON `payment_attempts` (`booking_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `refund_booking_status_idx` ON `refunds` (`booking_id`,`status`);--> statement-breakpoint
CREATE INDEX `outbox_pending_idx` ON `outbox_events` (`processed_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `court_blocks_range_idx` ON `court_blocks` (`venue_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `court_slot_lookup_idx` ON `court_slots` (`court_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `price_rule_scope_idx` ON `price_rules` (`venue_id`,`court_id`,`priority`,`active`);--> statement-breakpoint
CREATE INDEX `schedule_exception_date_idx` ON `schedule_exceptions` (`venue_id`,`local_date`);--> statement-breakpoint
ALTER TABLE `tenants` ADD CONSTRAINT `tenants_primary_owner_membership_fk` FOREIGN KEY (`primary_owner_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_venue_assignments` ADD CONSTRAINT `member_venue_assignments_venue_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `verification_documents` ADD CONSTRAINT `verification_documents_media_fk` FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_venue_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE restrict ON UPDATE no action;
