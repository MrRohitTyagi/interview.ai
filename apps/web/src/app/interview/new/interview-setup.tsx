"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GapAnalysis, InterviewType, ResumeAnalysis } from "@ai-interviewer/ai-core";
import { motion } from "motion/react";
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
};

const INTERVIEW_TYPES: { value: InterviewType; label: string; description: string; icon: typeof Code2 }[] = [
  { value: "mixed", label: "Mixed", description: "A balanced blend of everything below", icon: Shuffle },
  { value: "technical", label: "Technical", description: "Coding, systems, problem-solving", icon: Code2 },
  { value: "resume", label: "Resume-based", description: "Deep dive on your listed experience", icon: FileText },
  { value: "experience", label: "Experience-based", description: "Past projects and decisions", icon: Briefcase },
  { value: "hr", label: "HR / Behavioral", description: "Culture fit and soft skills", icon: Users },
];

const DIFFICULTIES: { value: "easy" | "medium" | "hard"; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const DURATIONS = [15, 30, 45];

const WIZARD_STEPS = ["Type", "Difficulty & time", "Instructions"] as const;

export function InterviewSetup({
  resume,
  jdId,
  gap,
}: {
  resume: { id: string; fileName: string | null; parsed: ResumeAnalysis };
  // Sourced server-side from resumes.lastJdId / lastGapAnalysisJson — the
  // resume's last persisted analysis, not a client-side carryover, so it's
  // correct on a fresh visit, a new tab, or a different device.
  jdId: string | null;
  gap: GapAnalysis | null;
}) {
  const router = useRouter();
  const [startLoading, setStartLoading] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [duration, setDuration] = useState(30);
  const [interviewType, setInterviewType] = useState<InterviewType>("mixed");
  const [customInstructions, setCustomInstructions] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

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

  function openWizard() {
    setWizardStep(0);
    setWizardOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <motion.div {...cardMotion}>
        <Card className="studio-panel studio-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Ready when you are
            </CardTitle>
            <CardDescription>
              {gap
                ? "Tailored to the job description you compared it against."
                : "A live, adaptive mock interview based on your resume."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-3.5 py-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileCheck2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{resume.fileName ?? "Your resume"}</p>
                <p className="text-xs text-muted-foreground">
                  {resume.parsed.skills.length} skills detected
                  {gap ? " · compared against a job description" : ""}
                </p>
              </div>
              <Link
                href="/analyze"
                className="shrink-0 text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                Change
              </Link>
            </div>

            <div className="flex flex-wrap gap-1">
              {resume.parsed.skills.slice(0, 8).map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={openWizard} size="lg" className="studio-glow gap-2">
                <Sparkles className="size-4" />
                Start interview
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set up your interview</DialogTitle>
            <DialogDescription>{WIZARD_STEPS[wizardStep]}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1.5">
            {WIZARD_STEPS.map((label, i) => (
              <div
                key={label}
                className={cn("h-1 flex-1 rounded-full transition-colors", i <= wizardStep ? "bg-primary" : "bg-muted")}
              />
            ))}
          </div>

          <div className="min-h-64">
            {wizardStep === 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {INTERVIEW_TYPES.map(({ value, label, description, icon: Icon }) => {
                  const selected = interviewType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInterviewType(value)}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-primary/60 bg-primary/10 studio-glow"
                          : "border-input hover:border-primary/30 hover:bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")} />
                        {selected && <CheckCircle2 className="size-4 text-primary" />}
                      </div>
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{description}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {wizardStep === 1 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-1.5">
                    <Gauge className="size-4" />
                    Difficulty
                  </Label>
                  <div className="flex gap-2">
                    {DIFFICULTIES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDifficulty(value)}
                        className={cn(
                          "flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                          difficulty === value
                            ? "border-primary/60 bg-primary/10 text-primary studio-glow"
                            : "border-input text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="size-4" />
                    Duration
                  </Label>
                  <div className="flex gap-2">
                    {DURATIONS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDuration(mins)}
                        className={cn(
                          "flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                          duration === mins
                            ? "border-primary/60 bg-primary/10 text-primary studio-glow"
                            : "border-input text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        )}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="customInstructions">
                    Anything specific you&apos;d like the interviewer to know or focus on? (optional)
                  </Label>
                  <textarea
                    id="customInstructions"
                    className="min-h-24 w-full rounded-md border border-input bg-background/40 p-2 text-sm outline-none focus:border-primary/50"
                    placeholder="e.g. Go easy on system design, I want to focus on debugging skills…"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{INTERVIEW_TYPES.find((t) => t.value === interviewType)?.label}</Badge>
                  <Badge variant="secondary" className="capitalize">
                    {difficulty}
                  </Badge>
                  <Badge variant="secondary">{duration} min</Badge>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <Button
              variant="ghost"
              className="gap-1.5"
              onClick={() => setWizardStep((s) => s - 1)}
              disabled={wizardStep === 0}
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>
            {wizardStep < WIZARD_STEPS.length - 1 ? (
              <Button className="gap-1.5" onClick={() => setWizardStep((s) => s + 1)}>
                Next
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button className="studio-glow gap-2" onClick={handleStartInterview} disabled={startLoading}>
                {startLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Start interview
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
