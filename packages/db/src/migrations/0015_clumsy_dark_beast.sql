ALTER TABLE `template` ADD `work_id` text REFERENCES `work`(`id`) ON UPDATE no action ON DELETE set null;
