CREATE TABLE `news_articles` (
	`url_hash` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`source` text NOT NULL,
	`source_key` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`published_at` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	`asset_classes` text NOT NULL,
	`keywords` text
);
--> statement-breakpoint
CREATE INDEX `news_published_idx` ON `news_articles` (`published_at`);--> statement-breakpoint
CREATE INDEX `news_source_idx` ON `news_articles` (`source_key`);