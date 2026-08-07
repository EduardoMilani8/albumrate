ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "spotify_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "spotify_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "spotify_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "spotify_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "spotify_connected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_spotify_id_unique" UNIQUE("spotify_id");