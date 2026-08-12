ALTER TABLE `questions` ADD `created_by_user_id` text;
--> statement-breakpoint
UPDATE `questions` SET `created_by_user_id` = (SELECT `owner_user_id` FROM `quizzes` WHERE `quizzes`.`id` = `questions`.`quiz_id`) WHERE `created_by_user_id` IS NULL;
