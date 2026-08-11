DROP INDEX `quiz_attempts_question_guild_user_unique`;
--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `session_id` text;
--> statement-breakpoint
CREATE INDEX `quiz_attempts_session_id_idx` ON `quiz_attempts` (`session_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_attempts_preview_question_guild_user_unique` ON `quiz_attempts` (`question_id`,`guild_id`,`user_id`) WHERE `session_id` IS NULL;
