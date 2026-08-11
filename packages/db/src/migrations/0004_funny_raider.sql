CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`actor_id` text,
	`work_id` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `notification_userId_read_idx` ON `notification` (`user_id`,`read`);--> statement-breakpoint
CREATE INDEX `notification_userId_createdAt_idx` ON `notification` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `remix` (
	`id` text PRIMARY KEY NOT NULL,
	`original_id` text NOT NULL,
	`fork_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`original_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fork_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `remix_fork_unique` ON `remix` (`fork_id`);--> statement-breakpoint
CREATE INDEX `remix_originalId_idx` ON `remix` (`original_id`);--> statement-breakpoint
CREATE TABLE `spark` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spark_user_work_unique` ON `spark` (`user_id`,`work_id`);--> statement-breakpoint
CREATE INDEX `spark_workId_idx` ON `spark` (`work_id`);--> statement-breakpoint
CREATE INDEX `spark_createdAt_idx` ON `spark` (`created_at`);--> statement-breakpoint
ALTER TABLE `work` ADD `sparks` integer DEFAULT 0 NOT NULL;