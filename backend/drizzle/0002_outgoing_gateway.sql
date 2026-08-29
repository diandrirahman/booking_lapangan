ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
UPDATE `users` AS `user`
INNER JOIN `auth_identities` AS `identity`
  ON `identity`.`user_id` = `user`.`id`
SET `user`.`password_hash` = `identity`.`password_hash`
WHERE `identity`.`provider` = 'PASSWORD'
  AND `identity`.`password_hash` IS NOT NULL;--> statement-breakpoint
DELETE FROM `auth_identities` WHERE `provider` = 'PASSWORD';--> statement-breakpoint
ALTER TABLE `auth_identities` DROP COLUMN `password_hash`;
