ALTER TABLE "interviews" ALTER COLUMN "jd_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_states" ADD COLUMN "planned_topics" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_states" ADD COLUMN "current_topic_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_states" ADD COLUMN "follow_ups_on_current_topic" integer DEFAULT 0 NOT NULL;