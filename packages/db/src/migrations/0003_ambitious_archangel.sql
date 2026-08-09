ALTER TABLE `work_comment` ADD `parent_id` text REFERENCES work_comment(id);--> statement-breakpoint
CREATE INDEX `work_comment_parentId_idx` ON `work_comment` (`parent_id`);