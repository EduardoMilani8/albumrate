ALTER TABLE "listening_logs" ADD COLUMN "album_genre" text;--> statement-breakpoint
ALTER TABLE "listening_logs" ADD COLUMN "album_year" integer;--> statement-breakpoint
ALTER TABLE "listening_logs" ADD COLUMN "album_country" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "album_genre" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "album_year" integer;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "album_country" text;