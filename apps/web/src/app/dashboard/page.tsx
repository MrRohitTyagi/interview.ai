import { redirect } from "next/navigation";
import Link from "next/link";
import { db, interviews, reports, users, codingAttempts } from "@ai-interviewer/db";
import { and, avg, count, desc, eq, or } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

import { DashboardAtmosphere } from "./dashboard-atmosphere";
import { FlowEntry } from "./flow-entry";
import { ProgressPanel } from "./progress-panel";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;

  const [statusCounts, typeCounts, avgScores, lastPracticedQuery, [currentUser], solvedCoding] = await Promise.all([
    db.select({ status: interviews.status, count: count() }).from(interviews).where(eq(interviews.userId, userId)).groupBy(interviews.status),
    db.select({ type: interviews.type, count: count() }).from(interviews).where(eq(interviews.userId, userId)).groupBy(interviews.type),
    db
      .select({ avgTechnical: avg(reports.technicalScore), avgCommunication: avg(reports.communicationScore) })
      .from(reports)
      .innerJoin(interviews, eq(reports.interviewId, interviews.id))
      .where(and(eq(interviews.userId, userId), eq(reports.status, "ready"))),
    db
      .select({ createdAt: interviews.createdAt })
      .from(interviews)
      .where(eq(interviews.userId, userId))
      .orderBy(desc(interviews.createdAt))
      .limit(1),
    db.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1),
    db.selectDistinct({ questionId: codingAttempts.questionId })
      .from(codingAttempts)
      .where(and(
        eq(codingAttempts.userId, userId),
        or(eq(codingAttempts.status, "success"), eq(codingAttempts.aiScore, 10), eq(codingAttempts.aiScore, 100))
      ))
  ]);

  const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const completed = statusCounts.find((s) => s.status === "completed")?.count ?? 0;
  const avgTechnicalRaw = avgScores[0]?.avgTechnical;
  const avgCommunicationRaw = avgScores[0]?.avgCommunication;
  const lastPracticedAt = lastPracticedQuery[0]?.createdAt ?? null;
  const solvedCodingCount = solvedCoding.length;

  return (
    <AppShell
      credits={currentUser?.creditBalance ?? 0}
      userName={session.user.name}
      userRole={session.user.role}
    >
      <div className="flex flex-col gap-8 max-w-5xl">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl font-heading">
            Welcome back{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm">Where do you want to start?</p>
        </div>
 
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <h2 className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground px-1">
              Active Channels
            </h2>
            <FlowEntry />
          </div>
 
          <div className="flex flex-col gap-3">
            <h2 className="font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground px-1">
              Coding Arena
            </h2>
            <div className="rounded-xl border border-border bg-card p-5 relative overflow-hidden flex flex-col justify-between h-full min-h-44">
              <DashboardAtmosphere />
              <div className="z-10">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="relative inline-flex rounded-full size-2 bg-primary"></span>
                  </span>
                  <span className="text-[0.62rem] font-mono uppercase tracking-wider text-primary">Problem solving</span>
                </div>
                <div className="mt-3 font-serif text-base leading-snug">
                  Sharpen your algorithmic skills and architecture design with AI feedback.
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-3 flex justify-between font-mono text-[0.68rem] text-muted-foreground z-10 items-center">
                <span>Total Solved: {solvedCodingCount}</span>
                <Link href="/coding" className="text-primary hover:underline hover:text-primary/80 transition-colors">Go to Arena &rarr;</Link>
              </div>
            </div>
          </div>
        </div>
 
        <ProgressPanel
          total={total}
          completed={completed}
          solvedCodingCount={solvedCodingCount}
          avgTechnical={avgTechnicalRaw ? Math.round(Number(avgTechnicalRaw)) : null}
          avgCommunication={avgCommunicationRaw ? Math.round(Number(avgCommunicationRaw)) : null}
          typeCounts={typeCounts}
          lastPracticedAt={lastPracticedAt}
        />
      </div>
    </AppShell>
  );
}

