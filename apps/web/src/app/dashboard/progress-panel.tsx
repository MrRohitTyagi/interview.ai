"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  ListChecks,
  Loader2,
  MessagesSquare,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { DeleteInterviewButton } from "./delete-interview-button";
import { EndInterviewButton } from "./end-interview-button";

type RecentInterview = {
  id: string;
  type: string;
  difficulty: string;
  status: string;
  durationMinutes: number;
  createdAt: Date;
  technicalScore: number | null;
  communicationScore: number | null;
  recommendation: string | null;
  reportStatus: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  technical: "Technical",
  resume: "Resume",
  experience: "Experience",
  hr: "HR",
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

function CountStat({ icon: Icon, label, value }: { icon: typeof ListChecks; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// Same visual as the per-answer technical/communication bars on the report
// page (report-view.tsx) — a dashboard average is the same kind of number,
// so it earns the same treatment instead of a new one invented just for
// this row.
function ScoreStat({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: number | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5" />
          {label}
        </span>
        <span className="font-mono font-medium text-foreground">{value ?? "—"}</span>
      </div>
      <Progress value={value ?? 0} className="h-1" />
    </div>
  );
}

// One glance should answer "do I need to do anything here" — a status
// badge with color + icon, not a line of small grey text easy to miss.
function StatusBadge({ r }: { r: RecentInterview }) {
  const isAbandoned = r.status === "abandoned";
  const isCompleted = r.status === "completed";
  const hasReport = r.reportStatus === "ready" && r.technicalScore !== null;

  if (isAbandoned) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Ban className="size-3" />
        Cancelled
      </Badge>
    );
  }
  if (!isCompleted) {
    return (
      <Badge variant="secondary" className="gap-1 text-primary">
        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
        In progress
      </Badge>
    );
  }
  if (hasReport) {
    return (
      <span className="flex items-center gap-2 font-mono text-xs text-primary">
        <Award className="size-3.5" />
        {r.technicalScore}
        {r.communicationScore !== null && <span className="text-muted-foreground">/ {r.communicationScore}</span>}
      </span>
    );
  }
  if (r.reportStatus === "generating") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="size-3 animate-spin" />
        Generating report
      </Badge>
    );
  }
  if (r.reportStatus === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" />
        Report failed — tap to retry
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Clock className="size-3" />
      Report pending
    </Badge>
  );
}

function InterviewRow({ r, index }: { r: RecentInterview; index: number }) {
  const reduceMotion = useReducedMotion();
  const isAbandoned = r.status === "abandoned";
  const isCompleted = r.status === "completed";
  const hasReport = r.reportStatus === "ready" && r.technicalScore !== null;
  const rowMotion = {
    initial: reduceMotion ? false : { opacity: 0, y: 8 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.6 },
    transition: { duration: 0.35, delay: Math.min(index, 6) * 0.04 },
  } as const;

  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="shrink-0 text-xs font-normal">
            {TYPE_LABELS[r.type] ?? r.type}
          </Badge>
          <span className="text-xs text-muted-foreground capitalize">{r.difficulty}</span>
          <span className="text-xs text-muted-foreground">· {r.durationMinutes} min</span>
        </div>
        {hasReport && r.recommendation && (
          <p className="truncate text-xs text-muted-foreground italic">{r.recommendation}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge r={r} />
        <span className="font-mono text-xs text-muted-foreground">{formatRelativeTime(r.createdAt)}</span>
      </div>
    </>
  );

  if (isAbandoned) {
    return (
      <motion.div {...rowMotion} className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm opacity-60">
        {body}
        <DeleteInterviewButton interviewId={r.id} />
      </motion.div>
    );
  }

  if (isCompleted) {
    return (
      <motion.div {...rowMotion}>
        <Link
          href={`/interview/${r.id}/report`}
          className="-mx-1 flex items-center justify-between gap-3 rounded-md px-1 py-3 text-sm transition-colors hover:bg-secondary/50"
        >
          {body}
        </Link>
      </motion.div>
    );
  }

  // In-progress / planned: not a full-row link, since it now carries two
  // separate actions (resume vs. end) that a nested anchor+button can't
  // represent without either invalid HTML or ambiguous clicks.
  return (
    <motion.div {...rowMotion} className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm">
      {body}
      <div className="flex shrink-0 items-center gap-1">
        <EndInterviewButton interviewId={r.id} />
        <Button render={<Link href={`/interview/${r.id}`} />} variant="default" size="sm" className="gap-1.5">
          Resume
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

export function ProgressPanel({
  total,
  completed,
  avgTechnical,
  avgCommunication,
  typeCounts,
  lastPracticedAt,
  recent,
}: {
  total: number;
  completed: number;
  avgTechnical: number | null;
  avgCommunication: number | null;
  typeCounts: { type: string; count: number }[];
  lastPracticedAt: Date | null;
  recent: RecentInterview[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-5"
      >
        <span className="flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
          <TrendingUp className="size-3.5" />
          Your progress
        </span>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <CountStat icon={ListChecks} label="Total attempts" value={total} />
          <CountStat icon={CheckCircle2} label="Finished" value={completed} />
          <ScoreStat icon={Target} label="Avg technical" value={avgTechnical} />
          <ScoreStat icon={MessagesSquare} label="Avg communication" value={avgCommunication} />
        </div>

        {(typeCounts.length > 0 || lastPracticedAt) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
            {typeCounts.map((t) => (
              <Badge key={t.type} variant="secondary">
                {t.count} {TYPE_LABELS[t.type] ?? t.type}
              </Badge>
            ))}
            {lastPracticedAt && (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="size-3" />
                Last practiced {formatRelativeTime(lastPracticedAt)}
              </span>
            )}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-1"
      >
        <span className="mb-2 flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
          <History className="size-3.5" />
          Interview history
        </span>
        {recent.length > 0 ? (
          <div className="flex flex-col divide-y divide-border">
            {recent.map((r, i) => (
              <InterviewRow key={r.id} r={r} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-input py-10 text-center">
            <Sparkles className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Your first interview will show up here.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
