ALTER TABLE `sessions` ADD `visitor_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_visitor_hash_unique` ON `sessions` (`visitor_hash`);