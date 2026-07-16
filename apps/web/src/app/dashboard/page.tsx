import { redirect } from "next/navigation";
import { db, interviews, reports, users } from "@ai-interviewer/db";
import { and, avg, count, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

import { DashboardAtmosphere } from "./dashboard-atmosphere";
import { FlowEntry } from "./flow-entry";
import { ProgressPanel } from "./progress-panel";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;

  const [statusCounts, typeCounts, avgScores, lastPracticedQuery, [currentUser]] = await Promise.all([
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
  ]);

  const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const completed = statusCounts.find((s) => s.status === "completed")?.count ?? 0;
  const avgTechnicalRaw = avgScores[0]?.avgTechnical;
  const avgCommunicationRaw = avgScores[0]?.avgCommunication;
  const lastPracticedAt = lastPracticedQuery[0]?.createdAt ?? null;

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
              Studio Signal
            </h2>
            <div className="rounded-xl border border-border bg-card p-5 relative overflow-hidden flex flex-col justify-between h-full min-h-[176px]">
              <DashboardAtmosphere />
              <div className="z-10">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[0.62rem] font-mono uppercase tracking-wider text-emerald-400">System Live</span>
                </div>
                <div className="mt-3 font-serif text-base leading-snug">
                  Audio-to-audio mock engine is operational. Select a channel to begin.
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-3 flex justify-between font-mono text-[0.68rem] text-muted-foreground z-10">
                <span>Practiced: {total}</span>
                <span>Completed: {completed}</span>
              </div>
            </div>
          </div>
        </div>
 
        <ProgressPanel
          total={total}
          completed={completed}
          avgTechnical={avgTechnicalRaw ? Math.round(Number(avgTechnicalRaw)) : null}
          avgCommunication={avgCommunicationRaw ? Math.round(Number(avgCommunicationRaw)) : null}
          typeCounts={typeCounts}
          lastPracticedAt={lastPracticedAt}
        />
      </div>
    </AppShell>
  );
}

