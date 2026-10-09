CREATE TABLE `usability_feedback` (
	`id` varchar(36) NOT NULL,
	`deviceType` enum('mobile','desktop','tablet','other') NOT NULL,
	`firstVisit` boolean NOT NULL,
	`taskResults` json NOT NULL,
	`sus1` int NOT NULL,
	`sus2` int NOT NULL,
	`sus3` int NOT NULL,
	`sus4` int NOT NULL,
	`sus5` int NOT NULL,
	`sus6` int NOT NULL,
	`sus7` int NOT NULL,
	`sus8` int NOT NULL,
	`sus9` int NOT NULL,
	`sus10` int NOT NULL,
	`susScore` float NOT NULL,
	`confusion` text,
	`suggestion` text,
	`consentedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usability_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `usability_feedback_created_idx` ON `usability_feedback` (`createdAt`);--> statement-breakpoint
CREATE INDEX `usability_feedback_device_idx` ON `usability_feedback` (`deviceType`);