CREATE TABLE `command_idempotency` (
	`id` char(26) NOT NULL,
	`scope` varchar(80) NOT NULL,
	`idempotency_key` varchar(160) NOT NULL,
	`actor_user_id` char(26) NOT NULL,
	`resource_id` char(26),
	`response_status` int,
	`response_body` json,
	`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	CONSTRAINT `command_idempotency_id` PRIMARY KEY(`id`),
	CONSTRAINT `command_idempotency_unique` UNIQUE(`scope`,`actor_user_id`,`idempotency_key`)
);
