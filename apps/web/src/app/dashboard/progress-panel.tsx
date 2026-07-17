"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  Calendar,
  CheckCircle2,
  ListChecks,
  MessagesSquare,
  Target,
  TrendingUp,
} from "lucide-react";

import { ScoreGauge } from "@/components/studio";

const TYPE_CHART_CLASSES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

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
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="studio-panel flex min-h-34 flex-col items-center justify-center gap-2 rounded-xl px-3 py-3 text-center"
    >
      <span className="flex items-center gap-1.5 font-mono text-[0.58rem] tracking-[0.08em] text-muted-foreground uppercase">
        <Icon className="size-3" />
        {label}
      </span>
      {children}
    </motion.div>
  );
}

function TypeBreakdown({
  typeCounts,
}: {
  typeCounts: { type: string; count: number }[];
}) {
  const reduceMotion = useReducedMotion();
  const total = typeCounts.reduce((sum, t) => sum + t.count, 0);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        {typeCounts.map((t, i) => (
          <motion.div
            key={t.type}
            className={TYPE_CHART_CLASSES[i % TYPE_CHART_CLASSES.length]}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${(t.count / total) * 100}%` }}
            transition={{
              duration: 0.5,
              delay: 0.1 + i * 0.04,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {typeCounts.map((t, i) => (
          <span
            key={t.type}
            className="flex items-center gap-1 font-mono text-[0.58rem] tracking-wide text-muted-foreground uppercase"
          >
            <span
              className={`size-1 rounded-full ${TYPE_CHART_CLASSES[i % TYPE_CHART_CLASSES.length]}`}
            />
            {TYPE_LABELS[t.type] ?? t.type} · {t.count}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProgressPanel({
  total,
  completed,
  avgTechnical,
  avgCommunication,
  typeCounts,
  lastPracticedAt,
}: {
  total: number;
  completed: number;
  solvedCodingCount: number;
  avgTechnical: number | null;
  avgCommunication: number | null;
  typeCounts: { type: string; count: number }[];
  lastPracticedAt: Date | null;
}) {
  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-4"
      >
        <span className="flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
          <TrendingUp className="size-3.5" />
          Performance Metrics
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={ListChecks} label="Attempts" index={0}>
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {total}
            </span>
          </StatTile>
          <StatTile icon={CheckCircle2} label="Completed" index={1}>
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {completed}
            </span>
            {total > 0 && (
              <span className="font-mono text-[0.58rem] text-muted-foreground">
                {Math.round((completed / total) * 100)}% Rate
              </span>
            )}
          </StatTile>

          <StatTile icon={Target} label="Avg Technical" index={3}>
            <ScoreGauge value={avgTechnical} size="sm" />
          </StatTile>
          <StatTile icon={MessagesSquare} label="Avg Behavior" index={4}>
            <ScoreGauge value={avgCommunication} size="sm" />
          </StatTile>
        </div>

        {(typeCounts.length > 0 || lastPracticedAt) && (
          <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
            <TypeBreakdown typeCounts={typeCounts} />
            {lastPracticedAt && (
              <span className="flex items-center gap-1 font-mono text-[0.58rem] text-muted-foreground uppercase">
                <Calendar className="size-3" />
                Last attempt {formatRelativeTime(lastPracticedAt)}
              </span>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
