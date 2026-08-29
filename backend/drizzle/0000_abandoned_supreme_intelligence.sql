CREATE TABLE `attendance_records` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'PENDING',
	`checked_in_at` datetime(6),
	`marked_by_user_id` char(26),
	`reason` text,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_addon_items` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`addon_id` char(26) NOT NULL,
	`name_snapshot` varchar(160) NOT NULL,
	`unit_price` bigint NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`total_price` bigint NOT NULL,
	CONSTRAINT `booking_addon_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_cancellations` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`actor_user_id` char(26),
	`reason` text NOT NULL,
	`kind` varchar(32) NOT NULL,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `booking_cancellations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_items` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`court_id` char(26) NOT NULL,
	`starts_at` datetime(6) NOT NULL,
	`ends_at` datetime(6) NOT NULL,
	`subtotal` bigint NOT NULL,
	CONSTRAINT `booking_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_price_lines` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`line_type` varchar(32) NOT NULL,
	`reference_id` char(26),
	`label` varchar(200) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unit_amount` bigint NOT NULL,
	`total_amount` bigint NOT NULL,
	`rule_snapshot` json,
	CONSTRAINT `booking_price_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_qr_tokens` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`expires_at` datetime(6) NOT NULL,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `booking_qr_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_qr_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `booking_reschedules` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`previous_slot_ids` json NOT NULL,
	`new_slot_ids` json NOT NULL,
	`reason` text NOT NULL,
	`actor_user_id` char(26),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `booking_reschedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_slot_history` (
	`id` char(26) NOT NULL,
	`court_slot_id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`action` varchar(24) NOT NULL,
	`reason` varchar(500),
	`occurred_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `booking_slot_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_slot_reservations` (
	`court_slot_id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`booking_item_id` char(26) NOT NULL,
	`reservation_status` varchar(24) NOT NULL,
	`expires_at` datetime(6),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `booking_slot_reservations_court_slot_id` PRIMARY KEY(`court_slot_id`)
);
--> statement-breakpoint
CREATE TABLE `booking_state_transitions` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`from_status` varchar(32),
	`to_status` varchar(32) NOT NULL,
	`actor_user_id` char(26),
	`reason` text,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `booking_state_transitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` char(26) NOT NULL,
	`booking_code` varchar(32) NOT NULL,
	`tenant_id` char(26) NOT NULL,
	`venue_id` char(26) NOT NULL,
	`customer_user_id` char(26),
	`source` varchar(16) NOT NULL,
	`status` varchar(32) NOT NULL,
	`payment_mode` varchar(24) NOT NULL,
	`total_amount` bigint NOT NULL,
	`balance_due` bigint NOT NULL,
	`hold_expires_at` datetime(6),
	`confirmation_expires_at` datetime(6),
	`version` int NOT NULL DEFAULT 1,
	`created_by_user_id` char(26) NOT NULL,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_code_unique` UNIQUE(`booking_code`)
);
--> statement-breakpoint
CREATE TABLE `offline_booking_details` (
	`booking_id` char(26) NOT NULL,
	`customer_name` varchar(160) NOT NULL,
	`customer_phone` varchar(32),
	`channel` varchar(32) NOT NULL,
	`original_amount` bigint NOT NULL,
	`adjusted_amount` bigint,
	`adjustment_reason` text,
	CONSTRAINT `offline_booking_details_booking_id` PRIMARY KEY(`booking_id`)
);
--> statement-breakpoint
CREATE TABLE `addon_courts` (
	`addon_id` char(26) NOT NULL,
	`court_id` char(26) NOT NULL,
	CONSTRAINT `addon_court_unique` UNIQUE(`addon_id`,`court_id`)
);
--> statement-breakpoint
CREATE TABLE `addons` (
	`id` char(26) NOT NULL,
	`venue_id` char(26) NOT NULL,
	`name` varchar(160) NOT NULL,
	`price` bigint NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `addons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courts` (
	`id` char(26) NOT NULL,
	`venue_id` char(26) NOT NULL,
	`sport_id` char(26) NOT NULL,
	`name` varchar(160) NOT NULL,
	`surface` varchar(120),
	`capacity` int,
	`status` varchar(24) NOT NULL DEFAULT 'ACTIVE',
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `courts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` char(26) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(120) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `facilities_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` char(26) NOT NULL,
	`owner_user_id` char(26),
	`storage_key` varchar(500) NOT NULL,
	`mime_type` varchar(120) NOT NULL,
	`byte_size` bigint NOT NULL,
	`visibility` varchar(24) NOT NULL,
	`alt_text` varchar(300),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotion_scopes` (
	`id` char(26) NOT NULL,
	`promotion_id` char(26) NOT NULL,
	`scope_type` varchar(40) NOT NULL,
	`scope_reference_id` char(26),
	`include_exclude` varchar(16) NOT NULL DEFAULT 'INCLUDE',
	CONSTRAINT `promotion_scopes_id` PRIMARY KEY(`id`),
	CONSTRAINT `promotion_scope_unique` UNIQUE(`promotion_id`,`scope_type`,`scope_reference_id`)
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` char(26) NOT NULL,
	`tenant_id` char(26),
	`name` varchar(160) NOT NULL,
	`description` text,
	`status` varchar(32) NOT NULL DEFAULT 'DRAFT',
	`starts_at` datetime(6) NOT NULL,
	`ends_at` datetime(6) NOT NULL,
	`discovery_only` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sports` (
	`id` char(26) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(120) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `sports_id` PRIMARY KEY(`id`),
	CONSTRAINT `sports_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `venue_facilities` (
	`venue_id` char(26) NOT NULL,
	`facility_id` char(26) NOT NULL,
	CONSTRAINT `venue_facility_unique` UNIQUE(`venue_id`,`facility_id`)
);
--> statement-breakpoint
CREATE TABLE `venue_media` (
	`venue_id` char(26) NOT NULL,
	`media_asset_id` char(26) NOT NULL,
	`purpose` varchar(32) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `venue_media_unique` UNIQUE(`venue_id`,`media_asset_id`)
);
--> statement-breakpoint
CREATE TABLE `venue_publication_requests` (
	`id` char(26) NOT NULL,
	`venue_id` char(26) NOT NULL,
	`venue_version` int NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'SUBMITTED',
	`submitted_snapshot` text NOT NULL,
	`reason` text,
	`submitted_by_user_id` char(26) NOT NULL,
	`decided_by_user_id` char(26),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`decided_at` datetime(6),
	CONSTRAINT `venue_publication_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venue_search_metrics` (
	`venue_id` char(26) NOT NULL,
	`rating_average` decimal(3,2) NOT NULL DEFAULT '0',
	`review_count` int NOT NULL DEFAULT 0,
	`popularity_score` int NOT NULL DEFAULT 0,
	`nearest_slot_starts_at` datetime(6),
	`minimum_price` bigint NOT NULL DEFAULT 0,
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `venue_search_metrics_venue_id` PRIMARY KEY(`venue_id`)
);
--> statement-breakpoint
CREATE TABLE `venue_sports` (
	`venue_id` char(26) NOT NULL,
	`sport_id` char(26) NOT NULL,
	CONSTRAINT `venue_sport_unique` UNIQUE(`venue_id`,`sport_id`)
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` char(26) NOT NULL,
	`tenant_id` char(26) NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text,
	`status` varchar(40) NOT NULL DEFAULT 'DRAFT',
	`publication_status` varchar(40) NOT NULL DEFAULT 'PRIVATE',
	`phone_e164` varchar(32),
	`email` varchar(255),
	`address_line` varchar(500) NOT NULL,
	`province_code` varchar(20),
	`city_code` varchar(20),
	`district_code` varchar(20),
	`postal_code` varchar(12),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`timezone` varchar(64) NOT NULL DEFAULT 'Asia/Jakarta',
	`indoor_outdoor_type` varchar(24) NOT NULL,
	`parking_info` varchar(1000),
	`house_rules` text,
	`emergency_contact` varchar(120),
	`version` int NOT NULL DEFAULT 1,
	`published_at` datetime(6),
	`suspended_at` datetime(6),
	`deleted_at` datetime(6),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `venues_id` PRIMARY KEY(`id`),
	CONSTRAINT `venues_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` char(26) NOT NULL,
	`tenant_id` char(26),
	`venue_id` char(26),
	`actor_user_id` char(26),
	`action` varchar(120) NOT NULL,
	`resource_type` varchar(80) NOT NULL,
	`resource_id` char(26),
	`reason` text,
	`before_state` json,
	`after_state` json,
	`request_id` varchar(80),
	`ip_address` varchar(64),
	`user_agent` varchar(500),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_identities` (
	`id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`provider_subject` varchar(255) NOT NULL,
	`password_hash` varchar(255),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `auth_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_provider_subject_unique` UNIQUE(`provider`,`provider_subject`),
	CONSTRAINT `auth_user_provider_unique` UNIQUE(`user_id`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `member_venue_assignments` (
	`id` char(26) NOT NULL,
	`membership_id` char(26) NOT NULL,
	`venue_id` char(26) NOT NULL,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `member_venue_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_venue_assignment_unique` UNIQUE(`membership_id`,`venue_id`)
);
--> statement-breakpoint
CREATE TABLE `owner_verification_cases` (
	`id` char(26) NOT NULL,
	`tenant_id` char(26) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'DRAFT',
	`submitted_snapshot` json,
	`reason` text,
	`version` char(26) NOT NULL,
	`submitted_at` datetime(6),
	`decided_at` datetime(6),
	`decided_by_user_id` char(26),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `owner_verification_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_admins` (
	`id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `platform_admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_admin_user_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_memberships` (
	`id` char(26) NOT NULL,
	`tenant_id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`role` varchar(32) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'ACTIVE',
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `tenant_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `memberships_tenant_user_unique` UNIQUE(`tenant_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` char(26) NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'DRAFT',
	`primary_owner_membership_id` char(26),
	`suspended_at` datetime(6),
	`deleted_at` datetime(6),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(26) NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone_e164` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`email_verified_at` datetime(6),
	`deleted_at` datetime(6),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification_documents` (
	`id` char(26) NOT NULL,
	`case_id` char(26) NOT NULL,
	`media_asset_id` char(26) NOT NULL,
	`document_type` varchar(40) NOT NULL,
	`simulated` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `verification_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_payment_summaries` (
	`booking_id` char(26) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'UNPAID',
	`total_paid` bigint NOT NULL DEFAULT 0,
	`total_refunded` bigint NOT NULL DEFAULT 0,
	`balance_due` bigint NOT NULL,
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `booking_payment_summaries_booking_id` PRIMARY KEY(`booking_id`)
);
--> statement-breakpoint
CREATE TABLE `payment_attempts` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`kind` varchar(24) NOT NULL,
	`amount` bigint NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'CREATED',
	`provider` varchar(32) NOT NULL DEFAULT 'MIDTRANS',
	`provider_reference` varchar(160),
	`redirect_url` varchar(1000),
	`idempotency_key` varchar(160) NOT NULL,
	`expires_at` datetime(6),
	`paid_at` datetime(6),
	`sandbox` boolean NOT NULL DEFAULT true,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `payment_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_attempt_idempotency_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `payment_provider_events` (
	`id` char(26) NOT NULL,
	`provider_event_id` varchar(200) NOT NULL,
	`payment_attempt_id` char(26),
	`signature_verified` boolean NOT NULL,
	`payload` json NOT NULL,
	`processed_at` datetime(6),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `payment_provider_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_provider_event_unique` UNIQUE(`provider_event_id`)
);
--> statement-breakpoint
CREATE TABLE `refund_state_transitions` (
	`id` char(26) NOT NULL,
	`refund_id` char(26) NOT NULL,
	`from_status` varchar(32),
	`to_status` varchar(32) NOT NULL,
	`payload` json,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `refund_state_transitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` char(26) NOT NULL,
	`booking_id` char(26) NOT NULL,
	`payment_attempt_id` char(26),
	`amount` bigint NOT NULL,
	`status` varchar(32) NOT NULL,
	`kind` varchar(40) NOT NULL,
	`reason` text NOT NULL,
	`idempotency_key` varchar(160) NOT NULL,
	`requested_by_user_id` char(26),
	`provider_reference` varchar(160),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `refund_idempotency_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `inbox_events` (
	`id` char(26) NOT NULL,
	`source` varchar(80) NOT NULL,
	`external_event_id` varchar(200) NOT NULL,
	`payload` json NOT NULL,
	`processed_at` datetime(6),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `inbox_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `inbox_source_event_unique` UNIQUE(`source`,`external_event_id`)
);
--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` char(26) NOT NULL,
	`tenant_id` char(26),
	`event_type` varchar(120) NOT NULL,
	`resource_type` varchar(80) NOT NULL,
	`resource_id` char(26) NOT NULL,
	`resource_version` int NOT NULL,
	`payload` json NOT NULL,
	`occurred_at` datetime(6) NOT NULL,
	`processed_at` datetime(6),
	`attempt_count` int NOT NULL DEFAULT 0,
	`last_error` text,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `outbox_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_buffer_options` (
	`id` char(26) NOT NULL,
	`minutes` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `booking_buffer_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_buffer_minutes_unique` UNIQUE(`minutes`)
);
--> statement-breakpoint
CREATE TABLE `booking_interval_options` (
	`id` char(26) NOT NULL,
	`minutes` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `booking_interval_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_interval_minutes_unique` UNIQUE(`minutes`)
);
--> statement-breakpoint
CREATE TABLE `court_blocks` (
	`id` char(26) NOT NULL,
	`venue_id` char(26) NOT NULL,
	`court_id` char(26),
	`kind` varchar(32) NOT NULL,
	`starts_at` datetime(6) NOT NULL,
	`ends_at` datetime(6) NOT NULL,
	`reason` varchar(500) NOT NULL,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `court_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `court_booking_settings` (
	`court_id` char(26) NOT NULL,
	`interval_minutes` int NOT NULL DEFAULT 60,
	`buffer_minutes` int NOT NULL DEFAULT 0,
	`minimum_duration_minutes` int NOT NULL DEFAULT 60,
	`maximum_duration_minutes` int NOT NULL DEFAULT 180,
	`booking_window_days` int NOT NULL DEFAULT 30,
	`minimum_lead_minutes` int NOT NULL DEFAULT 60,
	`updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `court_booking_settings_court_id` PRIMARY KEY(`court_id`)
);
--> statement-breakpoint
CREATE TABLE `court_slots` (
	`id` char(26) NOT NULL,
	`court_id` char(26) NOT NULL,
	`starts_at` datetime(6) NOT NULL,
	`ends_at` datetime(6) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'OPEN',
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `court_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `court_slot_range_unique` UNIQUE(`court_id`,`starts_at`,`ends_at`)
);
--> statement-breakpoint
CREATE TABLE `court_weekly_schedules` (
	`id` char(26) NOT NULL,
	`court_id` char(26) NOT NULL,
	`day_of_week` int NOT NULL,
	`opens_at` time NOT NULL,
	`closes_at` time NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `court_weekly_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `court_weekly_range_unique` UNIQUE(`court_id`,`day_of_week`,`opens_at`,`closes_at`)
);
--> statement-breakpoint
CREATE TABLE `payment_method_options` (
	`id` char(26) NOT NULL,
	`code` varchar(40) NOT NULL,
	`label` varchar(120) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `payment_method_options_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_method_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `price_rules` (
	`id` char(26) NOT NULL,
	`venue_id` char(26) NOT NULL,
	`court_id` char(26),
	`kind` varchar(32) NOT NULL,
	`priority` int NOT NULL,
	`day_of_week` int,
	`special_date` date,
	`starts_at_local` time,
	`ends_at_local` time,
	`amount` bigint NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`valid_from` datetime(6),
	`valid_until` datetime(6),
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `price_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_exceptions` (
	`id` char(26) NOT NULL,
	`venue_id` char(26) NOT NULL,
	`court_id` char(26),
	`local_date` date NOT NULL,
	`kind` varchar(24) NOT NULL,
	`opens_at` time,
	`closes_at` time,
	`reason` varchar(500),
	CONSTRAINT `schedule_exceptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venue_operating_hours` (
	`id` char(26) NOT NULL,
	`venue_id` char(26) NOT NULL,
	`day_of_week` int NOT NULL,
	`opens_at` time,
	`closes_at` time,
	`closed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `venue_operating_hours_id` PRIMARY KEY(`id`),
	CONSTRAINT `venue_operating_day_unique` UNIQUE(`venue_id`,`day_of_week`)
);
--> statement-breakpoint
CREATE TABLE `venue_payment_settings` (
	`venue_id` char(26) NOT NULL,
	`allow_full` boolean NOT NULL DEFAULT true,
	`allow_dp` boolean NOT NULL DEFAULT false,
	`dp_percentage` int,
	`allow_pay_at_venue` boolean NOT NULL DEFAULT false,
	`reservation_amount` bigint,
	`manual_confirmation_minutes` int NOT NULL DEFAULT 30,
	`balance_deadline_minutes` int,
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
ALTER TABLE `payment_provider_events` ADD CONSTRAINT `provider_events_attempt_fk` FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refund_state_transitions` ADD CONSTRAINT `refund_state_transitions_refund_id_refunds_id_fk` FOREIGN KEY (`refund_id`) REFERENCES `refunds`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_attempt_id_payment_attempts_id_fk` FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE `verification_documents` ADD CONSTRAINT `verification_documents_media_asset_fk` FOREIGN KEY (`media_asset_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE restrict ON UPDATE no action;
