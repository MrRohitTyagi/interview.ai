import Link from "next/link";
import { redirect } from "next/navigation";
import type { GapAnalysis, ResumeAnalysis } from "@ai-interviewer/ai-core";
import { db, jobDescriptions, resumes } from "@ai-interviewer/db";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";

import { InterviewSetup } from "./interview-setup";

export default async function NewInterviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const [latestResume] = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, session.user.id))
    .orderBy(desc(resumes.createdAt))
    .limit(1);

  // Interview setup needs an already-analyzed resume to plan topics around —
  // send anyone without one back to analyze first instead of duplicating the
  // upload/analyze UI on this page too.
  if (!latestResume?.parsedJson) redirect("/analyze");

  // Read the JD/gap straight from where /api/analyze persisted them — no
  // more sessionStorage bridge between the two pages, which used to silently
  // drop the JD if the candidate came back later, in a new tab, or on a
  // different device.
  const lastJd = latestResume.lastJdId
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
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Take the stage</h1>
        <p className="text-muted-foreground">Set up your session — type, difficulty, and time.</p>
      </div>

      <InterviewSetup
        resume={{
          id: latestResume.id,
          fileName: latestResume.fileName,
          parsed: latestResume.parsedJson as ResumeAnalysis,
        }}
        jdId={lastJd?.id ?? null}
        gap={latestResume.lastGapAnalysisJson as GapAnalysis | null}
      />
    </div>
  );
}
