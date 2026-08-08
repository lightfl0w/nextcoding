CREATE TABLE `work_version` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot_key` text NOT NULL,
	`message` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_version_workId_idx` ON `work_version` (`work_id`);--> statement-breakpoint
ALTER TABLE `work_file` ADD `version` integer DEFAULT 1 NOT NULL;