"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GapAnalysis, JDAnalysis, ResumeAnalysis } from "@ai-interviewer/ai-core";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ClipboardList, FileCheck2, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type UploadedResume = { id: string; fileName: string };
// jd/gap are always present together once a result exists — analysis
// without a JD isn't offered anymore, see the JD textarea's min-length gate
// below and the now-required jdText on /api/analyze.
type AnalyzeResult = {
  resume: { id: string; parsed: ResumeAnalysis };
  jd: { id: string; parsed: JDAnalysis };
  gap: GapAnalysis;
};

const MIN_JD_LENGTH = 50;

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-medium text-primary">
      {n}
    </span>
  );
}

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
};

export function ResumeAnalyzer({
  initialResume,
  initialAnalysis,
}: {
  initialResume: { id: string; fileName: string | null; parsed: ResumeAnalysis | null } | null;
  // The resume's persisted last analysis (see resumes.lastJdId /
  // lastGapAnalysisJson) — lets a returning visit show what was already
  // found instead of starting from a blank slate.
  initialAnalysis: { jd: { id: string; rawText: string; parsed: JDAnalysis }; gap: GapAnalysis } | null;
}) {
  const router = useRouter();
  const [resume, setResume] = useState<UploadedResume | null>(
    initialResume ? { id: initialResume.id, fileName: initialResume.fileName ?? "Your uploaded resume" } : null
  );
  const [jdText, setJdText] = useState(initialAnalysis?.jd.rawText ?? "");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(
    initialResume?.parsed && initialAnalysis
      ? {
          resume: { id: initialResume.id, parsed: initialResume.parsed },
          jd: { id: initialAnalysis.jd.id, parsed: initialAnalysis.jd.parsed },
          gap: initialAnalysis.gap,
        }
      : null
  );

  const jdReady = jdText.trim().length >= MIN_JD_LENGTH;

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/resumes", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResume({ id: data.id, fileName: data.fileName });
      toast.success("Resume uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadLoading(false);
      e.target.value = "";
    }
  }

  async function handleViewResume() {
    if (!resume) return;
    try {
      const res = await fetch(`/api/resumes/${resume.id}/url`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open resume");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open resume");
    }
  }

  async function handleAnalyze() {
    if (!resume || !jdReady) return;
    setAnalyzeLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id, jdText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
      toast.success("Analysis complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzeLoading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <motion.div {...cardMotion}>
        <Card className="studio-panel h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StepBadge n={1} />
              Resume
            </CardTitle>
            <CardDescription>Upload a PDF or DOCX (max 5MB).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-input px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleResumeUpload}
                disabled={uploadLoading}
                className="hidden"
              />
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                {uploadLoading ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
              </div>
              <span className="text-sm font-medium">
                {uploadLoading ? "Uploading…" : resume ? "Upload a new resume" : "Click to upload"}
              </span>
              <span className="text-xs text-muted-foreground">
                {resume ? "This replaces your current one" : "PDF or DOCX"}
              </span>
            </label>
            {resume && !uploadLoading && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
                <p className="flex min-w-0 items-center gap-1.5 text-sm text-primary">
                  <FileCheck2 className="size-4 shrink-0" />
                  <span className="truncate">{resume.fileName}</span>
                </p>
                <button
                  type="button"
                  onClick={handleViewResume}
                  className="shrink-0 cursor-pointer text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  View
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence>
        {resume && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ ...cardMotion.transition, delay: 0.05 }}
          >
            <Card className="studio-panel h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StepBadge n={2} />
                  <ClipboardList className="size-4 text-muted-foreground" />
                  Job description
                </CardTitle>
                <CardDescription>
                  Paste the full posting: the interview and match score are both built around it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="min-h-32 w-full rounded-md border border-input bg-background/40 p-2 text-sm outline-none transition-colors focus:border-primary/50"
                  placeholder="Paste job description…"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
                {jdText.trim().length > 0 && !jdReady && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {MIN_JD_LENGTH - jdText.trim().length} more characters needed.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resume && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ ...cardMotion.transition, delay: 0.1 }}
            className="md:col-span-2"
          >
            <Card className="studio-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StepBadge n={3} />
                  <Sparkles className="size-4 text-muted-foreground" />
                  Analyze
                </CardTitle>
                <CardDescription>Compares your resume against the job description above.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Button onClick={handleAnalyze} disabled={!jdReady || analyzeLoading} className="studio-glow w-fit gap-2">
                  {analyzeLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Analyze
                    </>
                  )}
                </Button>

                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-col gap-6 overflow-hidden"
                    >
                      <div>
                        <h3 className="mb-1 text-sm font-medium">Job description summary</h3>
                        <p className="text-sm text-muted-foreground">{result.jd.parsed.summary}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {result.jd.parsed.requiredSkills.slice(0, 10).map((skill) => (
                            <Badge key={skill} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span>Match score</span>
                            <span className="font-mono font-medium text-primary">{result.gap.matchScore}/100</span>
                          </div>
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            style={{ transformOrigin: "left" }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <Progress value={result.gap.matchScore} />
                          </motion.div>
                        </div>
                        <p className="text-sm">{result.gap.summary}</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <h4 className="mb-1 text-sm font-medium">Strengths</h4>
                            <ul className="list-inside list-disc text-sm text-muted-foreground">
                              {result.gap.strengths.map((s) => (
                                <li key={s}>{s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="mb-1 text-sm font-medium">Gaps</h4>
                            <ul className="list-inside list-disc text-sm text-muted-foreground">
                              {result.gap.gaps.map((g) => (
                                <li key={g}>{g}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div>
                          <h4 className="mb-1 text-sm font-medium">Interview focus areas</h4>
                          <div className="flex flex-wrap gap-1">
                            {result.gap.interviewFocusAreas.map((topic) => (
                              <Badge key={topic}>{topic}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-2"
          >
            <Card className="studio-panel studio-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StepBadge n={4} />
                  Ready when you are
                </CardTitle>
                <CardDescription>
                  Set up a live, adaptive mock interview tailored to your resume and this job description.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => router.push("/interview/new")} size="lg" className="studio-glow gap-2">
                  Continue to interview setup
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
