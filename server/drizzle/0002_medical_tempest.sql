CREATE TABLE "listening_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"album_id" text NOT NULL,
	"album_title" text NOT NULL,
	"album_artist" text NOT NULL,
	"album_artwork_url" text,
	"listened_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listening_logs" ADD CONSTRAINT "listening_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listening_logs_user_idx" ON "listening_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "listening_logs_album_idx" ON "listening_logs" USING btree ("album_id");