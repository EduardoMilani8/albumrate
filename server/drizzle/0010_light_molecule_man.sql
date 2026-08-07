CREATE TABLE "album_of_month" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" text NOT NULL,
	"album_title" text NOT NULL,
	"album_artist" text NOT NULL,
	"album_artwork_url" text,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "album_of_month_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_of_month_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"comment_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "album_of_month_comments" ADD CONSTRAINT "album_of_month_comments_album_of_month_id_album_of_month_id_fk" FOREIGN KEY ("album_of_month_id") REFERENCES "public"."album_of_month"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "album_of_month_comments" ADD CONSTRAINT "album_of_month_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "album_of_month_month_year_unique" ON "album_of_month" USING btree ("month","year");--> statement-breakpoint
CREATE INDEX "album_of_month_comments_aom_idx" ON "album_of_month_comments" USING btree ("album_of_month_id");