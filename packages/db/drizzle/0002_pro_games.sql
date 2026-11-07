CREATE TABLE `pro_champion_stats` (
	`scope` varchar(64) NOT NULL,
	`champion_id` varchar(64) NOT NULL,
	`position` enum('top','jungle','mid','adc','support') NOT NULL,
	`games` int NOT NULL,
	`picks` int NOT NULL,
	`bans` int NOT NULL,
	`presence` decimal(6,4) NOT NULL,
	`win_rate` decimal(6,4),
	`early_pick_rate` decimal(6,4),
	`computed_at` datetime NOT NULL,
	CONSTRAINT `pro_champion_stats_scope_champion_id_position_pk` PRIMARY KEY(`scope`,`champion_id`,`position`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `pro_game_actions` (
	`game_id` bigint unsigned NOT NULL,
	`side` enum('blue','red') NOT NULL,
	`type` enum('pick','ban') NOT NULL,
	`order` smallint,
	`position` enum('top','jungle','mid','adc','support'),
	`champion_id` varchar(64) NOT NULL,
	CONSTRAINT `pro_game_actions_game_id_champion_id_pk` PRIMARY KEY(`game_id`,`champion_id`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `pro_games` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`game_key` varchar(191) NOT NULL,
	`league` varchar(32) NOT NULL,
	`event` varchar(64) NOT NULL,
	`played_at` datetime NOT NULL,
	`game_number` varchar(16) NOT NULL,
	`patch` varchar(16) NOT NULL,
	`blue_team` varchar(128) NOT NULL,
	`red_team` varchar(128) NOT NULL,
	`winner_side` enum('blue','red') NOT NULL,
	`sources` json NOT NULL,
	CONSTRAINT `pro_games_id` PRIMARY KEY(`id`),
	CONSTRAINT `pro_games_game_key_unique` UNIQUE(`game_key`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
ALTER TABLE `pro_game_actions` ADD CONSTRAINT `pro_game_actions_game_id_pro_games_id_fk` FOREIGN KEY (`game_id`) REFERENCES `pro_games`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pro_game_actions_champion_id_idx` ON `pro_game_actions` (`champion_id`);--> statement-breakpoint
CREATE INDEX `pro_games_patch_league_idx` ON `pro_games` (`patch`,`league`);