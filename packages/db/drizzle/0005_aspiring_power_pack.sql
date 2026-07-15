ALTER TABLE "resumes" ADD COLUMN "last_jd_id" uuid;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "last_gap_analysis_json" jsonb;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_last_jd_id_job_descriptions_id_fk" FOREIGN KEY ("last_jd_id") REFERENCES "public"."job_descriptions"("id") ON DELETE no action ON UPDATE no action;