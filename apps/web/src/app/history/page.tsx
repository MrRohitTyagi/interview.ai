import { redirect } from "next/navigation";
import Link from "next/link";
import { db, interviews, reports, users } from "@ai-interviewer/db";
import { desc, eq } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Ban,
  Clock,
  History,
  Loader2,
  Mic,
  Sparkles,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { DeleteInterviewButton } from "../dashboard/delete-interview-button";
import { EndInterviewButton } from "../dashboard/end-interview-button";

const TYPE_LABELS: Record<string, string> = {
  technical: "Technical",
  resume: "Resume",
  experience: "Experience",
  hr: "Behavioral",
  mixed: "Mixed",
};

function formatRelativeTime(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function StatusBadge({ r }: { r: { status: string; reportStatus: string | null; technicalScore: number | null } }) {
  const isAbandoned = r.status === "abandoned";
  const isCompleted = r.status === "completed";
  const hasReport = r.reportStatus === "ready" && r.technicalScore !== null;

  if (isAbandoned) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground uppercase font-mono text-[0.62rem]">
        <Ban className="size-3" />
        Void
      </Badge>
    );
  }
  if (!isCompleted) {
    return (
      <Badge variant="secondary" className="gap-1 text-primary uppercase font-mono text-[0.62rem]">
        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        In progress
      </Badge>
    );
  }
  if (hasReport) {
    return (
      <span className="flex items-center gap-1.5 font-mono text-sm text-primary font-semibold">
        <Award className="size-3.5 text-primary" />
        Scores: {r.technicalScore}
        {r.communicationScore !== null && <span className="text-muted-foreground font-normal">/{r.communicationScore}</span>}
      </span>
    );
  }
  if (r.reportStatus === "generating") {
    return (
      <Badge variant="secondary" className="gap-1 font-mono text-[0.62rem] uppercase">
        <Loader2 className="size-3 animate-spin" />
        Generating
      </Badge>
    );
  }
  if (r.reportStatus === "failed") {
    return (
      <Badge variant="destructive" className="gap-1 font-mono text-[0.62rem] uppercase">
        <AlertTriangle className="size-3" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground font-mono text-[0.62rem] uppercase">
      <Clock className="size-3" />
      Pending
    </Badge>
  );
}

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;

  const [recentInterviews, [currentUser]] = await Promise.all([
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
      .orderBy(desc(interviews.createdAt)),
    db.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  return (
    <AppShell
      credits={currentUser?.creditBalance ?? 0}
      userName={session.user.name}
      userRole={session.user.role}
    >
      <div className="flex flex-col gap-8 max-w-4xl">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl font-heading flex items-center gap-2.5">
            <History className="size-7 text-primary" />
            Interview Logs
          </h1>
          <p className="text-muted-foreground text-sm">
            Review past scorecards, check focus areas, or resume ongoing practice sessions.
          </p>
        </div>

        {recentInterviews.length > 0 ? (
          <div className="grid gap-4">
            {recentInterviews.map((r) => {
              const isAbandoned = r.status === "abandoned";
              const isCompleted = r.status === "completed";
              const hasReport = r.reportStatus === "ready" && r.technicalScore !== null;
              
              return (
                <Card key={r.id} className="studio-panel studio-glow hover:border-border transition-all duration-300">
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-semibold text-[0.68rem] tracking-wide uppercase px-2 py-0.5">
                          {TYPE_LABELS[r.type] ?? r.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize font-mono">{r.difficulty}</span>
                        <span className="text-xs text-muted-foreground font-mono">· {r.durationMinutes} min</span>
                        <span className="text-xs text-muted-foreground font-mono">· {formatRelativeTime(r.createdAt)}</span>
                      </div>
                      
                      {hasReport && r.recommendation ? (
                        <p className="text-xs text-muted-foreground italic truncate max-w-[550px] mt-1 pr-4">
                          &ldquo;{r.recommendation}&rdquo;
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {isAbandoned 
                            ? "Session was cancelled before completion." 
                            : !isCompleted 
                              ? "Session is active and awaiting inputs." 
                              : "Scores are currently compiling."}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40 w-full sm:w-auto justify-between sm:justify-end">
                      <StatusBadge r={r} />
                      
                      <div className="flex items-center gap-1.5">
                        {isAbandoned ? (
                          <DeleteInterviewButton interviewId={r.id} />
                        ) : isCompleted ? (
                          <Button render={<Link href={`/interview/${r.id}/report`} />} size="sm" variant="outline" className="h-8 text-xs font-mono uppercase tracking-wide">
                            View Report
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <EndInterviewButton interviewId={r.id} />
                            <Button render={<Link href={`/interview/${r.id}`} />} variant="default" size="sm" className="gap-1 px-3 h-8 text-xs font-mono uppercase tracking-wider studio-glow">
                              Resume
                              <ArrowRight className="size-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border py-16 text-center bg-card/20">
            <Sparkles className="size-7 text-muted-foreground/60 animate-pulse" />
            <div className="flex flex-col gap-1 px-4">
              <h3 className="text-sm font-semibold">No interviews logged yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Get started by comparing your resume with a JD or launching a direct mockup session.
              </p>
            </div>
            <Button render={<Link href="/interview/new" />} className="studio-glow gap-2 mt-2">
              <Mic className="size-4" />
              Start Your First Interview
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
