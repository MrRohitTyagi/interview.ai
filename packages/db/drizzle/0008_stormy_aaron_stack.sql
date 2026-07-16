CREATE TYPE "public"."coding_attempt_status" AS ENUM('success', 'failed', 'ai_reviewed');--> statement-breakpoint
CREATE TABLE "coding_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"code" text NOT NULL,
	"status" "coding_attempt_status" NOT NULL,
	"ai_score" integer,
	"ai_feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coding_attempts" ADD CONSTRAINT "coding_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;