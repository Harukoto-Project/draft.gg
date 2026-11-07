CREATE TABLE `matchups` (
	`patch` varchar(16) NOT NULL,
	`tier` varchar(32) NOT NULL,
	`position` enum('top','jungle','mid','adc','support') NOT NULL,
	`champion_id` varchar(64) NOT NULL,
	`opponent_id` varchar(64) NOT NULL,
	`games` int NOT NULL,
	`win_rate` decimal(6,4) NOT NULL,
	CONSTRAINT `matchups_patch_tier_position_champion_id_opponent_id_pk` PRIMARY KEY(`patch`,`tier`,`position`,`champion_id`,`opponent_id`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `meta_stats` (
	`patch` varchar(16) NOT NULL,
	`tier` varchar(32) NOT NULL,
	`position` enum('top','jungle','mid','adc','support') NOT NULL,
	`champion_id` varchar(64) NOT NULL,
	`games` int NOT NULL,
	`win_rate` decimal(6,4) NOT NULL,
	`pick_rate` decimal(6,4) NOT NULL,
	`ban_rate` decimal(6,4) NOT NULL,
	`role_rate` decimal(6,4) NOT NULL,
	`tier_rank` smallint NOT NULL,
	`fetched_at` datetime(3) NOT NULL,
	CONSTRAINT `meta_stats_patch_tier_position_champion_id_pk` PRIMARY KEY(`patch`,`tier`,`position`,`champion_id`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `synergies` (
	`patch` varchar(16) NOT NULL,
	`tier` varchar(32) NOT NULL,
	`champion_id` varchar(64) NOT NULL,
	`position` enum('top','jungle','mid','adc','support') NOT NULL,
	`ally_id` varchar(64) NOT NULL,
	`ally_position` enum('top','jungle','mid','adc','support') NOT NULL,
	`games` int NOT NULL,
	`win_rate` decimal(6,4) NOT NULL,
	`score` decimal(10,4) NOT NULL,
	CONSTRAINT `synergies_patch_tier_champion_id_position_ally_id_ally_position_pk` PRIMARY KEY(`patch`,`tier`,`champion_id`,`position`,`ally_id`,`ally_position`)
) DEFAULT CHARSET=utf8mb4;
