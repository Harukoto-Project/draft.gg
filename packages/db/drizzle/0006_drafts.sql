CREATE TABLE `drafts` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`format` enum('ranked','tournament') NOT NULL,
	`my_side` enum('blue','red') NOT NULL,
	`state` json NOT NULL,
	`note` varchar(200) NOT NULL DEFAULT '',
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `drafts_id` PRIMARY KEY(`id`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
ALTER TABLE `drafts` ADD CONSTRAINT `drafts_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `drafts_owner_id_created_at_idx` ON `drafts` (`owner_id`,`created_at`);