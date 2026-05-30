CREATE TABLE `achievements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text DEFAULT '🏅',
	`color` text DEFAULT '#ffaa00',
	`xp_reward` integer DEFAULT 50 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `achievements_key_unique` ON `achievements` (`key`);--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trainee_id` text NOT NULL,
	`event` text NOT NULL,
	`detail` text,
	`page` text,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instructor_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trainee_id` text NOT NULL,
	`note` text NOT NULL,
	`author_id` text DEFAULT 'admin' NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`sender_role` text DEFAULT 'student' NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `module_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`module_id` integer NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`last_accessed_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`description` text,
	`icon` text DEFAULT '📡',
	`color` text DEFAULT '#1e90ff',
	`order` integer DEFAULT 0 NOT NULL,
	`lesson_count` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rank` text,
	`unit` text,
	`bio` text,
	`phone` text,
	`location` text,
	`updated_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`module_id` integer NOT NULL,
	`question` text NOT NULL,
	`option_a` text NOT NULL,
	`option_b` text NOT NULL,
	`option_c` text NOT NULL,
	`option_d` text NOT NULL,
	`correct_option` text NOT NULL,
	`explanation` text,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trainee_id` text NOT NULL,
	`module_id` integer NOT NULL,
	`module_name` text,
	`score` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`wrong` integer DEFAULT 0 NOT NULL,
	`pct` real DEFAULT 0 NOT NULL,
	`passed` integer DEFAULT 0 NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `streaks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_activity_date` text,
	`total_xp` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trainee_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trainee_id` text NOT NULL,
	`message` text NOT NULL,
	`alert_type` text DEFAULT 'info' NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trainee_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trainee_id` text NOT NULL,
	`sender_role` text DEFAULT 'admin' NOT NULL,
	`text` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`ts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trainee_module_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trainee_id` text NOT NULL,
	`module_id` integer NOT NULL,
	`module_name` text,
	`progress` real DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`assigned_by_admin` integer DEFAULT 0 NOT NULL,
	`last_accessed_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trainees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rank` text,
	`unit` text,
	`pin` text,
	`created_at` integer DEFAULT 0 NOT NULL,
	`last_login_at` integer DEFAULT 0,
	`login_count` integer DEFAULT 0 NOT NULL,
	`is_online` integer DEFAULT 0 NOT NULL,
	`last_page` text DEFAULT '/',
	`last_active_at` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`achievement_id` integer NOT NULL,
	`earned_at` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`achievement_id`) REFERENCES `achievements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`role` text DEFAULT 'student' NOT NULL,
	`avatar_url` text,
	`created_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);