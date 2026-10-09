CREATE TABLE `comments` (
	`id` varchar(36) NOT NULL,
	`poemId` varchar(36) NOT NULL,
	`authorId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`userId` int NOT NULL,
	`poemId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `likes_userId_poemId_pk` PRIMARY KEY(`userId`,`poemId`)
);
--> statement-breakpoint
CREATE TABLE `poems` (
	`id` varchar(36) NOT NULL,
	`authorId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`publishedAt` timestamp,
	CONSTRAINT `poems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(48);--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_poemId_poems_id_fk` FOREIGN KEY (`poemId`) REFERENCES `poems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `likes` ADD CONSTRAINT `likes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `likes` ADD CONSTRAINT `likes_poemId_poems_id_fk` FOREIGN KEY (`poemId`) REFERENCES `poems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `poems` ADD CONSTRAINT `poems_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `comments_poem_created_idx` ON `comments` (`poemId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `likes_poem_idx` ON `likes` (`poemId`);--> statement-breakpoint
CREATE INDEX `poems_author_status_idx` ON `poems` (`authorId`,`status`);--> statement-breakpoint
CREATE INDEX `poems_published_idx` ON `poems` (`status`,`publishedAt`);