ALTER TABLE `template` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `template` ADD `reviewed_by` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `template` ADD `reviewed_at` integer;--> statement-breakpoint
UPDATE `template` SET `status` = 'published';