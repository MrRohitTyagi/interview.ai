CREATE TYPE "public"."interview_type" AS ENUM('technical', 'resume', 'experience', 'hr', 'mixed');--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "type" "interview_type" DEFAULT 'mixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "custom_instructions" text;