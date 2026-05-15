CREATE TABLE `assets` (
	`symbol` text PRIMARY KEY NOT NULL,
	`class` text NOT NULL,
	`ticker` text NOT NULL,
	`name` text NOT NULL,
	`name_ko` text,
	`currency` text NOT NULL,
	`source` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assets_class_idx` ON `assets` (`class`);--> statement-breakpoint
CREATE INDEX `assets_ticker_idx` ON `assets` (`ticker`);--> statement-breakpoint
CREATE TABLE `backfill_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`from_t` integer NOT NULL,
	`to_t` integer NOT NULL,
	`rows_inserted` integer NOT NULL,
	`target` text NOT NULL,
	`source` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `backfill_symbol_idx` ON `backfill_log` (`symbol`);--> statement-breakpoint
CREATE INDEX `backfill_started_idx` ON `backfill_log` (`started_at`);--> statement-breakpoint
CREATE TABLE `candles` (
	`symbol` text NOT NULL,
	`t` integer NOT NULL,
	`o` real NOT NULL,
	`h` real NOT NULL,
	`l` real NOT NULL,
	`c` real NOT NULL,
	`v` real NOT NULL,
	`ingested_at` integer NOT NULL,
	PRIMARY KEY(`symbol`, `t`)
);
--> statement-breakpoint
CREATE INDEX `candles_t_idx` ON `candles` (`t`);--> statement-breakpoint
CREATE TABLE `indicators` (
	`symbol` text NOT NULL,
	`t` integer NOT NULL,
	`computed_version` integer NOT NULL,
	`sma_5` real,
	`sma_20` real,
	`sma_50` real,
	`sma_100` real,
	`sma_200` real,
	`ema_12` real,
	`ema_26` real,
	`ema_50` real,
	`rsi_14` real,
	`macd` real,
	`macd_signal` real,
	`macd_hist` real,
	`bb_upper` real,
	`bb_middle` real,
	`bb_lower` real,
	`atr_14` real,
	`vol_sma_20` real,
	`computed_at` integer NOT NULL,
	PRIMARY KEY(`symbol`, `t`)
);
