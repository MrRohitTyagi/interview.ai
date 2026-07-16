import { redirect } from "next/navigation";
import type { GapAnalysis, JDAnalysis, ResumeAnalysis } from "@ai-interviewer/ai-core";
import { db, jobDescriptions, resumes, users } from "@ai-interviewer/db";
import { desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

import { ResumeAnalyzer } from "./resume-analyzer";

export default async function AnalyzePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const [latestResume, [currentUser]] = await Promise.all([
    db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, session.user.id))
      .orderBy(desc(resumes.createdAt))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1),
  ]);

  // The last comparison this resume was run against, if any — persisted so
  // it survives past the browser tab it was computed in (previously it
  // only ever lived in the /api/analyze response).
  const lastJd = latestResume?.lastJdId
    ? (await db.select().from(jobDescriptions).where(eq(jobDescriptions.id, latestResume.lastJdId)).limit(1))[0]
    : null;

  return (
    <AppShell
      credits={currentUser?.creditBalance ?? 0}
      userName={session.user.name}
      userRole={session.user.role}
    >
      <div className="flex flex-col gap-6 max-w-5xl">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl font-heading">Resume & JD Fit</h1>
          <p className="text-muted-foreground text-sm">
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
    </AppShell>
  );
}

