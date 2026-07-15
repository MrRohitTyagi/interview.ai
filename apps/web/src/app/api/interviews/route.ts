import { NextResponse } from "next/server";
import {
  generateInterviewPlan,
  interviewTypeSchema,
  type GapAnalysis,
  type JDAnalysis,
  type ResumeAnalysis,
} from "@ai-interviewer/ai-core";
import { db, interviews, interviewStates, jobDescriptions, questions, resumes } from "@ai-interviewer/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";

const bodySchema = z.object({
  resumeId: z.string().uuid(),
  jdId: z.string().uuid().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  durationMinutes: z.number().int().min(10).max(60).default(30),
  interviewType: interviewTypeSchema.default("mixed"),
  customInstructions: z.string().max(2000).optional(),
  // Optional: pass through a gap analysis already computed by /api/analyze to
  // avoid paying for a second Claude call for the same comparison.
  gap: z
    .object({
      matchScore: z.number(),
      strengths: z.array(z.string()),
      gaps: z.array(z.string()),
      interviewFocusAreas: z.array(z.string()),
      summary: z.string(),
    })
    .optional(),
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

  if (!resume || !resume.parsedJson) {
    return NextResponse.json({ error: "Analyze a resume before starting an interview" }, { status: 400 });
  }

  let jd: { id: string; parsedJson: JDAnalysis } | null = null;
  if (parsed.data.jdId) {
    const [jdRow] = await db
      .select()
      .from(jobDescriptions)
      .where(and(eq(jobDescriptions.id, parsed.data.jdId), eq(jobDescriptions.userId, session.user.id)))
      .limit(1);
    if (!jdRow || !jdRow.parsedJson) {
      return NextResponse.json({ error: "Job description not found or not analyzed" }, { status: 400 });
    }
    jd = { id: jdRow.id, parsedJson: jdRow.parsedJson as JDAnalysis };
  }

  const plan = await generateInterviewPlan({
    resume: resume.parsedJson as ResumeAnalysis,
    jd: jd?.parsedJson ?? null,
    gap: (parsed.data.gap as GapAnalysis | undefined) ?? null,
    difficulty: parsed.data.difficulty,
    durationMinutes: parsed.data.durationMinutes,
    interviewType: parsed.data.interviewType,
    customInstructions: parsed.data.customInstructions,
  });

  const [interview] = await db
    .insert(interviews)
    .values({
      userId: session.user.id,
      resumeId: resume.id,
      jdId: jd?.id ?? null,
      durationMinutes: parsed.data.durationMinutes,
      difficulty: parsed.data.difficulty,
      type: parsed.data.interviewType,
      customInstructions: parsed.data.customInstructions,
      status: "in_progress",
      startedAt: new Date(),
    })
    .returning();

  const [openingQuestion] = await db
    .insert(questions)
    .values({
      interviewId: interview.id,
      parentQuestionId: null,
      topic: plan.topics[0].topic,
      difficulty: plan.topics[0].difficulty,
      question: plan.openingQuestion,
      order: 0,
      askedAt: new Date(),
    })
    .returning();

  await db.insert(interviewStates).values({
    interviewId: interview.id,
    currentQuestionId: openingQuestion.id,
    remainingTimeSeconds: parsed.data.durationMinutes * 60,
    coveredTopics: [],
    weakTopics: [],
    plannedTopics: plan.topics,
    currentTopicIndex: 0,
    followUpsOnCurrentTopic: 0,
  });

  return NextResponse.json({
    id: interview.id,
    topic: plan.topics[0].topic,
    question: plan.openingQuestion,
    totalTopics: plan.topics.length,
  });
}
