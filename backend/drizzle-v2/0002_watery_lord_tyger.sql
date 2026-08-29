CREATE TABLE `user_notifications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`kind` varchar(20) NOT NULL,
	`title` varchar(80) NOT NULL,
	`body` varchar(240) NOT NULL,
	`action_path` varchar(180) NOT NULL,
	`read_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_notifications` ADD CONSTRAINT `user_notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `user_notifications_feed_idx` ON `user_notifications` (`user_id`,`created_at`);