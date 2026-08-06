CREATE TABLE "media_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"media_type" text NOT NULL,
	"pressing_quality_rating" real NOT NULL,
	"edition_note" text,
	"condition" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_reviews" ADD CONSTRAINT "media_reviews_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_reviews_review_unique" ON "media_reviews" USING btree ("review_id");