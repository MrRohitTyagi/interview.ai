import { NextResponse } from "next/server";
import { generateReport, type InterviewType, type JDAnalysis, type ResumeAnalysis } from "@ai-interviewer/ai-core";
import {
  answers,
  db,
  evaluations,
  interviews,
  jobDescriptions,
  questions,
  reports,
  resumes,
} from "@ai-interviewer/db";
import { asc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";

async function loadInterviewOwned(interviewId: string, userId: string) {
  const [interview] = await db.select().from(interviews).where(eq(interviews.id, interviewId)).limit(1);
  if (!interview || interview.userId !== userId) return null;
  return interview;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: interviewId } = await params;

  const interview = await loadInterviewOwned(interviewId, session.user.id);
  if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

  const [report] = await db.select().from(reports).where(eq(reports.interviewId, interviewId)).limit(1);
  if (!report) {
    return NextResponse.json({ status: "not_generated" });
  }
  return NextResponse.json(report);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: interviewId } = await params;

  const interview = await loadInterviewOwned(interviewId, session.user.id);
  if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  if (interview.status !== "completed") {
    return NextResponse.json({ error: "Interview isn't completed yet" }, { status: 400 });
  }

  // Idempotent — a report that's already ready is returned as-is instead of
  // paying for another Opus call.
  const [existing] = await db.select().from(reports).where(eq(reports.interviewId, interviewId)).limit(1);
  if (existing && existing.status === "ready") {
    return NextResponse.json(existing);
  }

  // Atomically claim the generation slot. `interviewId` is unique on this
  // table, so if two requests land close together — the auto-trigger fired
  // on interview completion and the report page's own mount-effect, say —
  // only one insert wins; the loser must not fall through to a second
  // `db.insert` (that would throw a unique-violation) or a second Opus call
  // (wasted cost, and a data race writing the same report twice).
  let claimedNow = false;
  if (!existing) {
    const [claimed] = await db
      .insert(reports)
      .values({ interviewId, status: "generating" })
      .onConflictDoNothing()
      .returning();
    claimedNow = !!claimed;
  }
  if (!claimedNow) {
    const [current] = await db.select().from(reports).where(eq(reports.interviewId, interviewId)).limit(1);
    if (current.status === "ready") return NextResponse.json(current);
    if (current.status === "generating") {
      // Someone else (very likely the same request racing itself via the
      // auto-trigger) is already generating this report — tell the caller
      // to poll instead of duplicating the work.
      return NextResponse.json(current, { status: 202 });
    }
    // status === "failed" — this call is the retry; claim it.
    await db.update(reports).set({ status: "generating" }).where(eq(reports.interviewId, interviewId));
  }

  const [resume] = await db.select().from(resumes).where(eq(resumes.id, interview.resumeId)).limit(1);
  const jd = interview.jdId
    ? (await db.select().from(jobDescriptions).where(eq(jobDescriptions.id, interview.jdId)).limit(1))[0]
    : null;

  const interviewQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.interviewId, interviewId))
    .orderBy(asc(questions.order));

  const transcript: { topic: string; question: string; answer: string }[] = [];
  const answerIdByIndex: (string | null)[] = [];
  for (const q of interviewQuestions) {
    const [a] = await db.select().from(answers).where(eq(answers.questionId, q.id)).limit(1);
    if (a?.transcript) {
      transcript.push({ topic: q.topic, question: q.question, answer: a.transcript });
      answerIdByIndex.push(a.id);
    }
  }

  if (transcript.length === 0) {
    // Reset off "generating" — otherwise this row is stuck forever, since a
    // future POST would just see "generating" and 202 back to wait on a
    // generation that already bailed out and will never finish.
    await db.update(reports).set({ status: "failed" }).where(eq(reports.interviewId, interviewId));
    return NextResponse.json({ error: "No answers to evaluate" }, { status: 400 });
  }

  let report;
  try {
    report = await generateReport({
      transcript,
      resume: resume.parsedJson as ResumeAnalysis,
      jd: (jd?.parsedJson as JDAnalysis | undefined) ?? null,
      interviewType: interview.type as InterviewType,
    });
  } catch (err) {
    await db.update(reports).set({ status: "failed" }).where(eq(reports.interviewId, interviewId));
    throw err;
  }

  for (const evaluation of report.answerEvaluations) {
    const answerId = answerIdByIndex[evaluation.questionIndex];
    if (!answerId) continue;
    await db
      .insert(evaluations)
      .values({
        answerId,
        technicalScore: evaluation.technicalScore,
        communicationScore: evaluation.communicationScore,
        completenessScore: evaluation.completenessScore,
        confidenceScore: evaluation.confidenceScore,
        problemSolvingScore: evaluation.problemSolvingScore,
        notes: evaluation.notes,
      })
      .onConflictDoNothing();
  }

  const [savedReport] = await db
    .update(reports)
    .set({
      status: "ready",
      technicalScore: Math.round(report.overallTechnicalScore),
      communicationScore: Math.round(report.overallCommunicationScore),
      recommendation: report.recommendation,
      studyRoadmap: {
        items: report.studyRoadmap,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        summary: report.summary,
      },
      generatedAt: new Date(),
    })
    .where(eq(reports.interviewId, interviewId))
    .returning();

  return NextResponse.json(savedReport);
}
