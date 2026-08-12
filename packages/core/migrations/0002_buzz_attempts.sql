CREATE TABLE `buzz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`quiz_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`is_correct` integer NOT NULL,
	`is_winner` integer NOT NULL,
	`answered_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `buzz_attempts_guild_user_idx` ON `buzz_attempts` (`guild_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `buzz_attempts_quiz_id_idx` ON `buzz_attempts` (`quiz_id`);
--> statement-breakpoint
CREATE INDEX `buzz_attempts_session_id_idx` ON `buzz_attempts` (`session_id`);
