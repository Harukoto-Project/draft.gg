CREATE TABLE `player_pool_entries` (
	`profile_id` varchar(36) NOT NULL,
	`champion_id` varchar(64) NOT NULL,
	`position` enum('top','jungle','mid','adc','support') NOT NULL,
	`source` enum('opgg','manual') NOT NULL,
	`games` int,
	`win_rate` decimal(6,4),
	`excluded` boolean NOT NULL DEFAULT false,
	CONSTRAINT `player_pool_entries_profile_id_champion_id_position_pk` PRIMARY KEY(`profile_id`,`champion_id`,`position`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `player_profiles` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`display_name` varchar(50) NOT NULL,
	`riot_id` varchar(32),
	`region` varchar(8),
	`roles` json NOT NULL,
	`synced_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `player_profiles_id` PRIMARY KEY(`id`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
ALTER TABLE `player_pool_entries` ADD CONSTRAINT `player_pool_entries_profile_id_player_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `player_profiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD CONSTRAINT `player_profiles_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `player_profiles_owner_id_idx` ON `player_profiles` (`owner_id`);