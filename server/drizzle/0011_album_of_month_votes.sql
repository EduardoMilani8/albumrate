CREATE TABLE "monthly_vote_ballots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"album_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_vote_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_id" uuid NOT NULL,
	"album_id" text NOT NULL,
	"album_title" text NOT NULL,
	"album_artist" text NOT NULL,
	"album_artwork_url" text,
	"review_count" integer NOT NULL,
	"latest_review_at" timestamp with time zone NOT NULL,
	"average_rating" real,
	"position" integer NOT NULL,
	"final_votes" integer,
	"final_ranking" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"reveal_at" timestamp with time zone NOT NULL,
	"candidates_generated_at" timestamp with time zone,
	"tabulated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "album_of_month" ADD COLUMN "votes" integer;--> statement-breakpoint
ALTER TABLE "album_of_month" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "monthly_vote_ballots" ADD CONSTRAINT "monthly_vote_ballots_vote_id_monthly_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."monthly_votes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_vote_ballots" ADD CONSTRAINT "monthly_vote_ballots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_vote_candidates" ADD CONSTRAINT "monthly_vote_candidates_vote_id_monthly_votes_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."monthly_votes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_vote_ballots_vote_user_album_unique" ON "monthly_vote_ballots" USING btree ("vote_id","user_id","album_id");--> statement-breakpoint
CREATE INDEX "monthly_vote_ballots_vote_user_idx" ON "monthly_vote_ballots" USING btree ("vote_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_vote_candidates_vote_album_unique" ON "monthly_vote_candidates" USING btree ("vote_id","album_id");--> statement-breakpoint
CREATE INDEX "monthly_vote_candidates_vote_idx" ON "monthly_vote_candidates" USING btree ("vote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_votes_month_year_unique" ON "monthly_votes" USING btree ("month","year");--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_monthly_vote_ballot_limit() RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM monthly_vote_ballots
      WHERE vote_id = NEW.vote_id AND user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 votos por usuário por votação excedido.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER monthly_vote_ballots_limit_trigger
BEFORE INSERT ON monthly_vote_ballots
FOR EACH ROW EXECUTE FUNCTION check_monthly_vote_ballot_limit();