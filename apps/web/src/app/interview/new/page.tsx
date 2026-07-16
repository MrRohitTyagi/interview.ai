import { redirect } from "next/navigation";
import type { GapAnalysis, ResumeAnalysis } from "@ai-interviewer/ai-core";
import { db, jobDescriptions, resumes, users } from "@ai-interviewer/db";
import { desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

import { InterviewSetup } from "./interview-setup";

export default async function NewInterviewPage() {
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
    <AppShell
      credits={currentUser?.creditBalance ?? 0}
      userName={session.user.name}
      userRole={session.user.role}
    >
      <div className="flex flex-col gap-6 max-w-5xl">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl font-heading">Start Interview</h1>
          <p className="text-muted-foreground text-sm">Set up your session: type, difficulty, and time.</p>
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
    </AppShell>
  );
}

