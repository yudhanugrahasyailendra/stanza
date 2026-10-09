CREATE TABLE `account_sessions` (
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_sessions_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `local_credentials` (
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(180) NOT NULL,
	`passwordUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `local_credentials_userId` PRIMARY KEY(`userId`),
	CONSTRAINT `local_credentials_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `birthDate` date;--> statement-breakpoint
ALTER TABLE `users` ADD `language` enum('id','en') DEFAULT 'id' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `theme` enum('light','dark','system') DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_sessions` ADD CONSTRAINT `account_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `local_credentials` ADD CONSTRAINT `local_credentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_sessions_user_expiry_idx` ON `account_sessions` (`userId`,`expiresAt`);