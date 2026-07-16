import Link from "next/link";
import { redirect } from "next/navigation";
import { db, interviews, reports, users } from "@ai-interviewer/db";
import { and, avg, count, desc, eq } from "drizzle-orm";
import { Coins, LogOut } from "lucide-react";

import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { DashboardAtmosphere } from "./dashboard-atmosphere";
import { FlowEntry } from "./flow-entry";
import { ProgressPanel } from "./progress-panel";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;

  // Independent queries — none depend on another's result — so they run
  // concurrently instead of stacking sequential round trips.
  const [statusCounts, typeCounts, avgScores, recentInterviews, [currentUser]] = await Promise.all([
    db.select({ status: interviews.status, count: count() }).from(interviews).where(eq(interviews.userId, userId)).groupBy(interviews.status),
    db.select({ type: interviews.type, count: count() }).from(interviews).where(eq(interviews.userId, userId)).groupBy(interviews.type),
    db
      .select({ avgTechnical: avg(reports.technicalScore), avgCommunication: avg(reports.communicationScore) })
      .from(reports)
      .innerJoin(interviews, eq(reports.interviewId, interviews.id))
      .where(and(eq(interviews.userId, userId), eq(reports.status, "ready"))),
    db
      .select({
        id: interviews.id,
        type: interviews.type,
        difficulty: interviews.difficulty,
        status: interviews.status,
        durationMinutes: interviews.durationMinutes,
        createdAt: interviews.createdAt,
        technicalScore: reports.technicalScore,
        communicationScore: reports.communicationScore,
        recommendation: reports.recommendation,
        reportStatus: reports.status,
      })
      .from(interviews)
      .leftJoin(reports, eq(reports.interviewId, interviews.id))
      .where(eq(interviews.userId, userId))
      .orderBy(desc(interviews.createdAt))
      .limit(12),
    db.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const completed = statusCounts.find((s) => s.status === "completed")?.count ?? 0;
  const avgTechnicalRaw = avgScores[0]?.avgTechnical;
  const avgCommunicationRaw = avgScores[0]?.avgCommunication;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 p-6 sm:p-10">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Link href="/" className="font-serif text-lg text-muted-foreground hover:text-foreground">
          interview<span className="accent-text font-semibold">.ai</span>
        </Link>
        <div className="flex items-center gap-2">
          {session.user.role === "admin" && (
            <Link href="/admin/codes" className="text-xs text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          )}
          <Link
            href="/profile"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Coins className="size-3 text-primary" />
            {currentUser?.creditBalance ?? 0}
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button variant="outline" size="sm" type="submit" className="gap-1.5">
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </form>
        </div>
      </div>

      <div className="relative flex flex-col gap-8">
        <DashboardAtmosphere />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground">Where do you want to start?</p>
        </div>

        <FlowEntry />
      </div>

      <ProgressPanel
        total={total}
        completed={completed}
        avgTechnical={avgTechnicalRaw ? Math.round(Number(avgTechnicalRaw)) : null}
        avgCommunication={avgCommunicationRaw ? Math.round(Number(avgCommunicationRaw)) : null}
        typeCounts={typeCounts}
        lastPracticedAt={recentInterviews[0]?.createdAt ?? null}
        recent={recentInterviews}
      />
    </div>
  );
}
