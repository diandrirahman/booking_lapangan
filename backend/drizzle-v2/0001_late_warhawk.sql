ALTER TABLE `payment_attempts` ADD `payment_code` varchar(20);--> statement-breakpoint
UPDATE `payment_attempts`
SET `payment_code` = CONCAT(
  'PAY-',
  UPPER(SUBSTRING(SHA2(CONCAT(UUID(), UUID(), `id`), 256), 1, 16))
);--> statement-breakpoint
ALTER TABLE `payment_attempts` MODIFY `payment_code` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_attempts` ADD CONSTRAINT `payment_attempt_code_unique` UNIQUE(`payment_code`);--> statement-breakpoint
UPDATE `bookings`
SET `booking_code` = CONCAT(
  'LG-',
  UPPER(SUBSTRING(SHA2(CONCAT(UUID(), UUID(), `id`), 256), 1, 16))
);
