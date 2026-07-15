import Link from "next/link";
import { redirect } from "next/navigation";
import type { GapAnalysis, JDAnalysis, ResumeAnalysis } from "@ai-interviewer/ai-core";
import { db, jobDescriptions, resumes } from "@ai-interviewer/db";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";

import { ResumeAnalyzer } from "./resume-analyzer";

export default async function AnalyzePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const [latestResume] = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, session.user.id))
    .orderBy(desc(resumes.createdAt))
    .limit(1);

  // The last comparison this resume was run against, if any — persisted so
  // it survives past the browser tab it was computed in (previously it
  // only ever lived in the /api/analyze response).
  const lastJd = latestResume?.lastJdId
    ? (await db.select().from(jobDescriptions).where(eq(jobDescriptions.id, latestResume.lastJdId)).limit(1))[0]
    : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Know your fit</h1>
        <p className="text-muted-foreground">
          Upload your resume, paste the job description you&apos;re aiming for, and see exactly where you stand.
        </p>
      </div>

      <ResumeAnalyzer
        initialResume={
          latestResume
            ? {
                id: latestResume.id,
                fileName: latestResume.fileName,
                parsed: latestResume.parsedJson as ResumeAnalysis | null,
              }
            : null
        }
        initialAnalysis={
          latestResume?.parsedJson && lastJd && latestResume.lastGapAnalysisJson
            ? {
                jd: { id: lastJd.id, rawText: lastJd.rawText, parsed: lastJd.parsedJson as JDAnalysis },
                gap: latestResume.lastGapAnalysisJson as GapAnalysis,
              }
            : null
        }
      />
    </div>
  );
}
