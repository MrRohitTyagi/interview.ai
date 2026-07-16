"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowLeft, Award, BookOpen, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScoreGauge } from "@/components/studio";

type StudyRoadmapItem = { topic: string; why: string; resources: string[] };
export type ReportData = {
  id: string;
  status: "pending" | "generating" | "ready" | "failed";
  technicalScore: number | null;
  communicationScore: number | null;
  recommendation: string | null;
  studyRoadmap: { items: StudyRoadmapItem[]; strengths: string[]; weaknesses: string[]; summary: string } | null;
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export function ReportView({
  interviewId,
  initialReport,
  fillerWordsCount,
  isPublic,
}: {
  interviewId: string;
  initialReport: ReportData | null;
  fillerWordsCount?: number;
  isPublic?: boolean;
}) {
  const [report, setReport] = useState<ReportData | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const reduceMotion = useReducedMotion();

  // Kicks off generation. A 202 means someone else — almost always the
  // fire-and-forget trigger fired the moment the interview completed — is
  // already generating this report, so it hands back straight to the poll
  // loop below instead of starting a second (expensive, redundant) run.
  async function triggerGeneration() {
    const res = await fetch(`/api/interviews/${interviewId}/report`, { method: "POST" });
    const data = await res.json();
    if (!res.ok && res.status !== 202) throw new Error(data.error ?? "Failed to generate report");
    return data as ReportData;
  }

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function pollUntilDone() {
      pollTimer = setInterval(async () => {
        try {
          const res = await fetch(`/api/interviews/${interviewId}/report`);
          const data = (await res.json()) as ReportData;
          if (cancelled) return;
          if (data.status === "ready" || data.status === "failed") {
            setReport(data);
            if (pollTimer) clearInterval(pollTimer);
          }
        } catch {
          // transient — the next tick tries again
        }
      }, 3000);
    }

    async function run() {
      if (!report) {
        // No report row at all yet — this is the very first visit, so
        // generation hasn't started anywhere. Kick it off ourselves.
        setLoading(true);
        try {
          const data = await triggerGeneration();
          if (cancelled) return;
          setReport(data);
          if (data.status === "generating") pollUntilDone();
        } catch (err) {
          if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to generate report");
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else if (report.status === "generating") {
        // Already in flight elsewhere (e.g. the auto-trigger on interview
        // completion) — just watch for it to finish, don't re-trigger.
        pollUntilDone();
      }
    }

    if (!isPublic) {
      void run();
    }
    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublic, interviewId]);

  async function retry() {
    setLoading(true);
    try {
      const data = await triggerGeneration();
      setReport(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  if (report?.status === "failed" && !loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="size-5 text-destructive" />
        <p className="font-medium">Couldn&apos;t generate this report</p>
        <p className="text-sm text-muted-foreground">Something went wrong while reviewing the transcript.</p>
        <button
          onClick={retry}
          className="cursor-pointer font-mono text-xs tracking-wide text-primary underline underline-offset-4 hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!report || report.status !== "ready" || loading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <motion.div
          className="size-16 rounded-full bg-primary opacity-70 blur-md"
          animate={reduceMotion ? { opacity: [0.5, 0.7, 0.5] } : { scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <div>
          <p className="font-medium">Generating your report…</p>
          <p className="text-sm text-muted-foreground">Reviewing the full transcript; this takes a moment.</p>
        </div>
      </div>
    );
  }

  const roadmap = report.studyRoadmap;
  const overall =
    report.technicalScore !== null && report.communicationScore !== null
      ? Math.round((report.technicalScore + report.communicationScore) / 2)
      : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      {!isPublic && (
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5 h-8 text-xs font-medium"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/report/${interviewId}`);
              toast.success("Public link copied to clipboard!");
            }}
          >
            <Share2 className="size-3.5" />
            Share Report
          </Button>
        </div>
      )}

      <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
        <Card className="studio-panel studio-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Award className="size-5 text-primary" />
              Interview report
            </CardTitle>
            <CardDescription>{report.recommendation}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="mx-auto shrink-0 sm:mx-0">
              <ScoreGauge value={overall} size="lg" label="Overall" />
            </div>
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Technical</span>
                  <span className="font-mono font-medium">{report.technicalScore}/100</span>
                </div>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  style={{ transformOrigin: "left" }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Progress value={report.technicalScore ?? 0} className="h-1.5" />
                </motion.div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Communication</span>
                  <span className="font-mono font-medium">{report.communicationScore}/100</span>
                </div>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  style={{ transformOrigin: "left" }}
                  transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Progress value={report.communicationScore ?? 0} className="h-1.5" />
                </motion.div>
              </div>
              {fillerWordsCount !== undefined && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Filler Words</span>
                    <span className="font-mono font-medium">{fillerWordsCount}</span>
                  </div>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    style={{ transformOrigin: "left" }}
                    transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Progress value={Math.max(0, 100 - (fillerWordsCount * 5))} className="h-1.5 [&>div]:bg-amber-500" />
                  </motion.div>
                </div>
              )}
              {roadmap && <p className="text-sm text-muted-foreground">{roadmap.summary}</p>}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {roadmap && (
        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="studio-panel">
            <CardHeader>
              <CardTitle>Strengths &amp; weaknesses</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-primary">
                  <ThumbsUp className="size-3.5" />
                  Strengths
                </h4>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {roadmap.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <ThumbsDown className="size-3.5" />
                  Weaknesses
                </h4>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {roadmap.weaknesses.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {roadmap && (
        <motion.div {...fadeUp} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card className="studio-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                Study roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {roadmap.items.map((item) => (
                <div key={item.topic} className="flex flex-col gap-1.5 px-6 py-4">
                  <h4 className="text-sm font-medium">{item.topic}</h4>
                  <p className="text-sm text-muted-foreground">{item.why}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.resources.map((r) => (
                      <Badge key={r} variant="secondary">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
