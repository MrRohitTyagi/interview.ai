import { NextResponse } from "next/server";
import { analyzeGap, analyzeJobDescription, analyzeResume, type ResumeAnalysis } from "@ai-interviewer/ai-core";
import { db, jobDescriptions, resumes } from "@ai-interviewer/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";

const bodySchema = z.object({
  resumeId: z.string().uuid(),
  // Required, not optional — a resume-only analysis has no gap/match score
  // to show and nothing to carry into interview planning, so it isn't a
  // useful standalone step anymore. See the "Launch scope" note this
  // decision came out of.
  jdText: z
    .string()
    .min(50, "Paste the full job description (at least 50 characters)")
    .max(20000, "That's too long for a job description — paste just the posting text"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [resume] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, parsed.data.resumeId), eq(resumes.userId, session.user.id)))
    .limit(1);

  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // Reuse the existing analysis if this resume was already analyzed in an
  // earlier call — avoids re-paying for it when the user just adds a JD.
  const resumeAnalysis =
    (resume.parsedJson as ResumeAnalysis | null) ?? (await analyzeResume(resume.rawText));

  if (!resume.parsedJson) {
    await db.update(resumes).set({ parsedJson: resumeAnalysis }).where(eq(resumes.id, resume.id));
  }

  const jdAnalysis = await analyzeJobDescription(parsed.data.jdText);
  const [jdRow] = await db
    .insert(jobDescriptions)
    .values({
      userId: session.user.id,
      rawText: parsed.data.jdText,
      parsedJson: jdAnalysis,
    })
    .returning();
  const gap = await analyzeGap(resumeAnalysis, jdAnalysis);

  // Persist this as the resume's "last analysis" — previously only ever
  // returned in this response and lost the moment the tab closed, which is
  // exactly the gap (no pun intended) that made /interview/new unable to
  // reliably know which JD/gap to carry into a new session.
  await db
    .update(resumes)
    .set({ lastJdId: jdRow.id, lastGapAnalysisJson: gap })
    .where(eq(resumes.id, resume.id));

  return NextResponse.json({
    resume: { id: resume.id, parsed: resumeAnalysis },
    jd: { id: jdRow.id, parsed: jdAnalysis },
    gap,
  });
}
