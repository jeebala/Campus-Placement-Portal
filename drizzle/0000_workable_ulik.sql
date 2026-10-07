CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`job_id` text NOT NULL,
	`status` text DEFAULT 'Applied' NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "application_status" CHECK("applications"."status" IN ('Applied','Shortlisted','Interview','Offered','Rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_application_student_job` ON `applications` (`student_id`,`job_id`);--> statement-breakpoint
CREATE INDEX `idx_application_job` ON `applications` (`job_id`);--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`reviewer_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_name` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`industry` text NOT NULL,
	`website` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "company_status" CHECK("companies"."status" IN ('pending','approved','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_owner_id_unique` ON `companies` (`owner_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`status` text NOT NULL,
	`actor_id` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_application` ON `events` (`application_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`location` text NOT NULL,
	`salary` text NOT NULL,
	`description` text NOT NULL,
	`min_cgpa` real NOT NULL,
	`departments` text NOT NULL,
	`graduation_year` integer NOT NULL,
	`deadline` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "job_status" CHECK("jobs"."status" IN ('pending','approved','rejected')),
	CONSTRAINT "job_cgpa" CHECK("jobs"."min_cgpa" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_company` ON `jobs` (`company_id`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attempt_email_time` ON `login_attempts` (`email`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`branch` text NOT NULL,
	`cgpa` real NOT NULL,
	`graduation_year` integer NOT NULL,
	`resume` text NOT NULL,
	`skills` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "valid_cgpa" CHECK("profiles"."cgpa" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text NOT NULL,
	CONSTRAINT "valid_role" CHECK("users"."role" IN ('student','recruiter','admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);