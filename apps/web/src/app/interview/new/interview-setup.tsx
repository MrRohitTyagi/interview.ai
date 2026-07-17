"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GapAnalysis, InterviewType, ResumeAnalysis } from "@ai-interviewer/ai-core";
import { motion } from "motion/react";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Code2,
  FileCheck2,
  FileText,
  Gauge,
  Loader2,
  Shuffle,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
};

const INTERVIEW_TYPES: { value: InterviewType; label: string; description: string; icon: typeof Code2 }[] = [
  { value: "mixed", label: "Mixed Channel", description: "Balanced blend of all formats", icon: Shuffle },
  { value: "technical", label: "Technical depth", description: "System design & problem solving", icon: Code2 },
  { value: "resume", label: "Resume-based", description: "Deep dive on your experience", icon: FileText },
  { value: "experience", label: "Experience-based", description: "Past project decisions & scale", icon: Briefcase },
  { value: "hr", label: "Behavioral / HR", description: "Culture fit & soft skills", icon: Users },
];

const DIFFICULTIES: { value: "easy" | "medium" | "hard"; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const DURATIONS = [15, 30, 45];

export function InterviewSetup({
  resume,
  jdId,
  gap,
}: {
  resume: { id: string; fileName: string | null; parsed: ResumeAnalysis };
  jdId: string | null;
  gap: GapAnalysis | null;
}) {
  const router = useRouter();
  const [startLoading, setStartLoading] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [duration, setDuration] = useState(30);
  const [interviewType, setInterviewType] = useState<InterviewType>("mixed");
  const [customInstructions, setCustomInstructions] = useState("");

  async function handleStartInterview() {
    setStartLoading(true);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: resume.id,
          jdId: jdId ?? undefined,
          gap: gap ?? undefined,
          difficulty,
          durationMinutes: duration,
          interviewType,
          customInstructions: customInstructions.trim() ? customInstructions : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start interview");
      router.push(`/interview/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start interview");
      setStartLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl">
      <motion.div {...cardMotion}>
        <Card className="studio-panel studio-glow">
          <CardHeader className="border-b border-border/60 pb-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Calibrate Session
                </CardTitle>
                <CardDescription className="text-xs">
                  {gap
                    ? "Targeted to your uploaded resume and the job description fit analysis."
                    : "Configure your practice session using your active resume parameters."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-1.5 shrink-0">
                <FileCheck2 className="size-3.5 text-muted-foreground" />
                <span className="truncate text-xs font-medium max-w-30 lg:max-w-45">
                  {resume.fileName ?? "Resume"}
                </span>
                <Link
                  href="/analyze"
                  className="text-[0.68rem] text-primary hover:underline font-mono uppercase ml-1"
                >
                  Change
                </Link>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="grid gap-8 p-6 md:grid-cols-[1.1fr_0.9fr] pt-6">
            {/* Left Column: Interview Type */}
            <div className="flex flex-col gap-4">
              <span className="font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground px-0.5">
                1. Select Channel Type
              </span>
              <div className="flex flex-col gap-2">
                {INTERVIEW_TYPES.map(({ value, label, description, icon: Icon }) => {
                  const selected = interviewType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInterviewType(value)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-xl border p-3.5 text-left transition-all",
                        selected
                          ? "border-primary/50 bg-primary/5 text-foreground"
                          : "border-border hover:border-primary/25 hover:bg-secondary/20 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex size-8 items-center justify-center rounded-lg border",
                          selected ? "bg-primary/10 border-primary/20 text-primary" : "bg-card border-border text-muted-foreground"
                        )}>
                          <Icon className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className={cn("text-xs font-semibold", selected ? "text-foreground" : "text-muted-foreground")}>
                            {label}
                          </span>
                          <span className="text-[0.68rem] text-muted-foreground/80 mt-0.5 leading-snug">
                            {description}
                          </span>
                        </div>
                      </div>
                      {selected && <CheckCircle2 className="size-4.5 text-primary shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Settings and launch */}
            <div className="flex flex-col gap-6">
              {/* Difficulty */}
              <div className="flex flex-col gap-2.5">
                <Label className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                  <Gauge className="size-3.5" />
                  2. Difficulty
                </Label>
                <div className="flex gap-2">
                  {DIFFICULTIES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDifficulty(value)}
                      className={cn(
                        "flex-1 cursor-pointer rounded-lg border py-2 text-xs font-semibold transition-all text-center",
                        difficulty === value
                          ? "border-primary/50 bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/25 hover:bg-secondary/20 hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="flex flex-col gap-2.5">
                <Label className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                  <Clock className="size-3.5" />
                  3. Session Duration
                </Label>
                <div className="flex gap-2">
                  {DURATIONS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDuration(mins)}
                      className={cn(
                        "flex-1 cursor-pointer rounded-lg border py-2 text-xs font-semibold transition-all text-center",
                        duration === mins
                          ? "border-primary/50 bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/25 hover:bg-secondary/20 hover:text-foreground"
                      )}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Instructions */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="customInstructions" className="font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                  4. Focus Targets (Optional)
                </Label>
                <textarea
                  id="customInstructions"
                  className="min-h-18 w-full rounded-lg border border-border bg-background/40 p-3 text-xs outline-none focus:border-primary/50 placeholder:text-muted-foreground/60 leading-normal resize-none"
                  placeholder="e.g. Focus on distributed systems, skip basic OOP questions..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                />
              </div>

              {/* Start Action */}
              <div className="pt-2 border-t border-border/60 mt-auto flex flex-col gap-2.5">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[0.62rem] font-mono tracking-wide uppercase px-2 py-0.5">
                    {INTERVIEW_TYPES.find((t) => t.value === interviewType)?.label}
                  </Badge>
                  <Badge variant="outline" className="text-[0.62rem] font-mono tracking-wide uppercase px-2 py-0.5">
                    {difficulty}
                  </Badge>
                  <Badge variant="outline" className="text-[0.62rem] font-mono tracking-wide uppercase px-2 py-0.5">
                    {duration} min
                  </Badge>
                </div>
                
                <Button
                  onClick={handleStartInterview}
                  disabled={startLoading}
                  size="lg"
                  className="w-full studio-glow gap-2 mt-1"
                >
                  {startLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Initializing Session…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Start Mock Interview
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
