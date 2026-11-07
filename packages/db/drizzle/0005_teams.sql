CREATE TABLE `team_members` (
	`team_id` varchar(36) NOT NULL,
	`position` enum('top','jungle','mid','adc','support') NOT NULL,
	`profile_id` varchar(36) NOT NULL,
	CONSTRAINT `team_members_team_id_position_pk` PRIMARY KEY(`team_id`,`position`),
	CONSTRAINT `team_members_team_profile_uq` UNIQUE(`team_id`,`profile_id`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`name` varchar(50) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_profile_id_player_profiles_id_fk` FOREIGN KEY (`profile_id`) REFERENCES `player_profiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_owner_id_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `teams_owner_id_idx` ON `teams` (`owner_id`);