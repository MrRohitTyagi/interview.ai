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

import { ScoreGauge } from "@/components/studio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DeleteInterviewButton } from "./delete-interview-button";
import { EndInterviewButton } from "./end-interview-button";

// Tonal steps of the one amber accent, not a rainbow palette — matches the
// chart-1..chart-5 tokens already reserved for exactly this (DESIGN.md
// "The One Signal Rule").
const TYPE_CHART_CLASSES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

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

// One shared tile shell so all four stats — two raw counts, two gauges —
// read as the same instrument-panel control rather than four ad hoc
// layouts. Fixed min-height keeps the row aligned regardless of which
// content (a number vs. a 72px gauge) each tile ends up holding.
function StatTile({
  icon: Icon,
  label,
  index,
  children,
}: {
  icon: typeof ListChecks;
  label: string;
  index: number;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="studio-panel flex min-h-[9.5rem] flex-col items-center justify-center gap-2 rounded-md px-3 py-4 text-center"
    >
      <span className="flex items-center gap-1.5 font-mono text-[0.62rem] tracking-[0.08em] text-muted-foreground uppercase">
        <Icon className="size-3" />
        {label}
      </span>
      {children}
    </motion.div>
  );
}

// The proportional makeup of practiced interview types — a set of loose
// badges doesn't communicate mix, a stacked bar does. Each segment gets its
// own tonal amber step (see TYPE_CHART_CLASSES) so five types stay visually
// distinct without introducing a second accent color.
function TypeBreakdown({ typeCounts }: { typeCounts: { type: string; count: number }[] }) {
  const reduceMotion = useReducedMotion();
  const total = typeCounts.reduce((sum, t) => sum + t.count, 0);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
        {typeCounts.map((t, i) => (
          <motion.div
            key={t.type}
            className={TYPE_CHART_CLASSES[i % TYPE_CHART_CLASSES.length]}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${(t.count / total) * 100}%` }}
            transition={{ duration: 0.6, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {typeCounts.map((t, i) => (
          <span
            key={t.type}
            className="flex items-center gap-1.5 font-mono text-[0.62rem] tracking-wide text-muted-foreground uppercase"
          >
            <span className={`size-1.5 rounded-full ${TYPE_CHART_CLASSES[i % TYPE_CHART_CLASSES.length]}`} />
            {TYPE_LABELS[t.type] ?? t.type} · {t.count}
          </span>
        ))}
      </div>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={ListChecks} label="Total attempts" index={0}>
            <span className="font-mono text-3xl font-semibold tabular-nums">{total}</span>
          </StatTile>
          <StatTile icon={CheckCircle2} label="Finished" index={1}>
            <span className="font-mono text-3xl font-semibold tabular-nums">{completed}</span>
            {total > 0 && (
              <span className="font-mono text-[0.62rem] text-muted-foreground">
                {Math.round((completed / total) * 100)}% completion
              </span>
            )}
          </StatTile>
          <StatTile icon={Target} label="Avg technical" index={2}>
            <ScoreGauge value={avgTechnical} size="sm" />
          </StatTile>
          <StatTile icon={MessagesSquare} label="Avg communication" index={3}>
            <ScoreGauge value={avgCommunication} size="sm" />
          </StatTile>
        </div>

        {(typeCounts.length > 0 || lastPracticedAt) && (
          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <TypeBreakdown typeCounts={typeCounts} />
            {lastPracticedAt && (
              <span className="flex items-center gap-1 font-mono text-[0.62rem] text-muted-foreground uppercase">
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
