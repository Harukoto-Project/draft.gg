CREATE TABLE `champions` (
	`id` varchar(64) NOT NULL,
	`numeric_key` int NOT NULL,
	`name_ja` varchar(64) NOT NULL,
	`name_en` varchar(64) NOT NULL,
	`tags` json NOT NULL,
	`damage_type` enum('ad','ap','mixed'),
	`traits` json,
	`image_version` varchar(32) NOT NULL,
	CONSTRAINT `champions_id` PRIMARY KEY(`id`),
	CONSTRAINT `champions_numeric_key_unique` UNIQUE(`numeric_key`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`job` varchar(64) NOT NULL,
	`status` enum('running','success','failed') NOT NULL,
	`started_at` datetime(3) NOT NULL,
	`finished_at` datetime(3),
	`summary` json,
	`error` text,
	CONSTRAINT `job_runs_id` PRIMARY KEY(`id`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE `patches` (
	`version` varchar(16) NOT NULL,
	`released_at` datetime,
	`is_current` boolean NOT NULL DEFAULT false,
	CONSTRAINT `patches_version` PRIMARY KEY(`version`)
) DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE INDEX `job_runs_job_started_at_idx` ON `job_runs` (`job`,`started_at`);