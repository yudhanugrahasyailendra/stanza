ALTER TABLE `notifications` MODIFY COLUMN `poemId` varchar(36);--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `kind` enum('like','comment','follow') NOT NULL;