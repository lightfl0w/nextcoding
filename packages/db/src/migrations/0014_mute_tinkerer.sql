CREATE TABLE `template_use` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`work_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `template`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `template_use_templateId_idx` ON `template_use` (`template_id`);--> statement-breakpoint
CREATE INDEX `template_use_workId_idx` ON `template_use` (`work_id`);--> statement-breakpoint
ALTER TABLE `work` ADD `is_template` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `work` ADD `template_use_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `work` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `template` ADD `author_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `template` ADD `rating` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `template` ADD `rating_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `template_authorId_idx` ON `template` (`author_id`);