CREATE TABLE `report` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`handled_by` text,
	`handled_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`handled_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_reporter_work_unique` ON `report` (`reporter_id`,`work_id`);--> statement-breakpoint
CREATE INDEX `report_status_createdAt_idx` ON `report` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `report_workId_idx` ON `report` (`work_id`);