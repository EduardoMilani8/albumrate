CREATE TABLE "physical_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"album_id" text NOT NULL,
	"album_title" text NOT NULL,
	"album_artist" text NOT NULL,
	"album_artwork_url" text,
	"media_type" text NOT NULL,
	"edition_note" text,
	"condition" text NOT NULL,
	"price_paid" numeric(10, 2),
	"acquired_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "physical_collection" ADD CONSTRAINT "physical_collection_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "physical_collection_user_idx" ON "physical_collection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "physical_collection_user_media_idx" ON "physical_collection" USING btree ("user_id","media_type");