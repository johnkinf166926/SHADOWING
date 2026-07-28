CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audio_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`storage_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`duration_ms` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audio_assets_storage_path_idx` ON `audio_assets` (`storage_path`);--> statement-breakpoint
CREATE INDEX `audio_assets_filename_idx` ON `audio_assets` (`filename`);--> statement-breakpoint
CREATE TABLE `daily_study_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`study_date` text NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`lesson_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_study_logs_date_idx` ON `daily_study_logs` (`study_date`);--> statement-breakpoint
CREATE TABLE `dialogue_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`dialogue_id` text NOT NULL,
	`line_order` integer NOT NULL,
	`speaker` text NOT NULL,
	`text` text NOT NULL,
	`reading` text,
	`translation_zh` text,
	`translation_en` text,
	`start_ms` integer,
	`end_ms` integer,
	`note` text,
	FOREIGN KEY (`dialogue_id`) REFERENCES `dialogues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dialogue_lines_dialogue_order_idx` ON `dialogue_lines` (`dialogue_id`,`line_order`);--> statement-breakpoint
CREATE INDEX `dialogue_lines_time_idx` ON `dialogue_lines` (`start_ms`,`end_ms`);--> statement-breakpoint
CREATE TABLE `dialogues` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`number` integer NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dialogues_lesson_number_idx` ON `dialogues` (`lesson_id`,`number`);--> statement-breakpoint
CREATE TABLE `dictation_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`line_id` text NOT NULL,
	`answer` text NOT NULL,
	`normalized` text NOT NULL,
	`accuracy` real NOT NULL,
	`correct` integer NOT NULL,
	`diff_json` text NOT NULL,
	`added_to_review` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`line_id`) REFERENCES `dialogue_lines`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `dictation_lesson_created_idx` ON `dictation_attempts` (`lesson_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `dictation_line_correct_idx` ON `dictation_attempts` (`line_id`,`correct`);--> statement-breakpoint
CREATE TABLE `expressions` (
	`id` text PRIMARY KEY NOT NULL,
	`expression` text NOT NULL,
	`reading` text,
	`explanation_zh` text,
	`explanation_ja` text,
	`example` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`mastery_level` integer DEFAULT 0 NOT NULL,
	`next_review_at` text,
	`favorite` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expressions_next_review_idx` ON `expressions` (`next_review_at`);--> statement-breakpoint
CREATE INDEX `expressions_favorite_idx` ON `expressions` (`favorite`);--> statement-breakpoint
CREATE TABLE `lesson_expressions` (
	`lesson_id` text NOT NULL,
	`expression_id` text NOT NULL,
	PRIMARY KEY(`lesson_id`, `expression_id`),
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expression_id`) REFERENCES `expressions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`section_number` integer NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`track_number` text NOT NULL,
	`pdf_page` integer,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`audio_asset_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`audio_asset_id`) REFERENCES `audio_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_track_number_idx` ON `lessons` (`track_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_unit_section_idx` ON `lessons` (`unit_id`,`section_number`);--> statement-breakpoint
CREATE INDEX `lessons_unit_status_idx` ON `lessons` (`unit_id`,`status`);--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`dialogue_id` text,
	`line_id` text,
	`mode` text NOT NULL,
	`started_at` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`recording_path` text,
	`self_pronunciation_score` integer,
	`self_rhythm_score` integer,
	`self_fluency_score` integer,
	`started_within_target` integer,
	`completed` integer DEFAULT false NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`dialogue_id`) REFERENCES `dialogues`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`line_id`) REFERENCES `dialogue_lines`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `practice_sessions_lesson_started_idx` ON `practice_sessions` (`lesson_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `practice_sessions_mode_started_idx` ON `practice_sessions` (`mode`,`started_at`);--> statement-breakpoint
CREATE TABLE `recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`practice_session_id` text,
	`storage_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`duration_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`practice_session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recordings_storage_path_idx` ON `recordings` (`storage_path`);--> statement-breakpoint
CREATE INDEX `recordings_session_idx` ON `recordings` (`practice_session_id`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text,
	`line_id` text,
	`expression_id` text,
	`ease_factor` real DEFAULT 2.5 NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`repetitions` integer DEFAULT 0 NOT NULL,
	`next_review_at` text NOT NULL,
	`last_rating` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`line_id`) REFERENCES `dialogue_lines`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`expression_id`) REFERENCES `expressions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `review_items_next_review_idx` ON `review_items` (`next_review_at`);--> statement-breakpoint
CREATE INDEX `review_items_expression_idx` ON `review_items` (`expression_id`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_number_idx` ON `units` (`number`);