CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`owner_user_id` text NOT NULL,
	`owner_guild_id` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quizzes_owner_guild_id_idx` ON `quizzes` (`owner_guild_id`);
--> statement-breakpoint
CREATE INDEX `quizzes_owner_user_id_idx` ON `quizzes` (`owner_user_id`);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`type` text NOT NULL,
	`body` text NOT NULL,
	`choices` text,
	`answers` text NOT NULL,
	`explanation` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `questions_quiz_id_idx` ON `questions` (`quiz_id`);
--> statement-breakpoint
CREATE TABLE `quiz_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`target_guild_id` text NOT NULL,
	`shared_by_user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_shares_quiz_target_unique` ON `quiz_shares` (`quiz_id`,`target_guild_id`);
--> statement-breakpoint
CREATE INDEX `quiz_shares_target_guild_id_idx` ON `quiz_shares` (`target_guild_id`);
--> statement-breakpoint
CREATE TABLE `quiz_editors` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`added_by_user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_editors_quiz_target_unique` ON `quiz_editors` (`quiz_id`,`target_type`,`target_id`);
--> statement-breakpoint
CREATE INDEX `quiz_editors_quiz_id_idx` ON `quiz_editors` (`quiz_id`);
--> statement-breakpoint
CREATE INDEX `quiz_editors_target_idx` ON `quiz_editors` (`target_type`,`target_id`);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`quiz_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`is_correct` integer NOT NULL,
	`submitted_answer` text,
	`answered_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_attempts_question_guild_user_unique` ON `quiz_attempts` (`question_id`,`guild_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_quiz_id_idx` ON `quiz_attempts` (`quiz_id`);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_guild_user_idx` ON `quiz_attempts` (`guild_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_user_id_idx` ON `quiz_attempts` (`user_id`);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`subject_key` text NOT NULL,
	`window_start` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limits_scope_subject_unique` ON `rate_limits` (`scope`,`subject_key`);
