DROP INDEX `lessons_unit_section_idx`;--> statement-breakpoint
CREATE INDEX `lessons_unit_section_lookup_idx` ON `lessons` (`unit_id`,`section_number`);