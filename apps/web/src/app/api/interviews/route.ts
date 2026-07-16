import { NextResponse } from "next/server";
import {
  generateInterviewPlan,
  topicCountForDuration,
  interviewTypeSchema,
  type GapAnalysis,
  type JDAnalysis,
  type ResumeAnalysis,
} from "@ai-interviewer/ai-core";
import {
  applyCreditDelta,
  CREDIT_COSTS,
  db,
  estimateInterviewCost,
  InsufficientCreditsError,
  interviews,
  interviewStates,
  jobDescriptions,
  questions,
  resumes,
  users,
} from "@ai-interviewer/db";
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

  // Pre-flight affordability check — before any Claude call, so a request
  // that was always going to be rejected never spends anything. Uses the
  // same expected-case formula documented in Token.LLD.md Section 4.
  const estimatedTopicCount = topicCountForDuration(parsed.data.durationMinutes);
  const estimatedCost = estimateInterviewCost(estimatedTopicCount);
  const [currentUser] = await db
    .select({ creditBalance: users.creditBalance })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!currentUser || currentUser.creditBalance < estimatedCost) {
    return NextResponse.json(
      {
        error: "Not enough credits to start this interview",
        needed: estimatedCost,
        balance: currentUser?.creditBalance ?? 0,
      },
      { status: 402 }
    );
  }

  const plan = await generateInterviewPlan({
    resume: resume.parsedJson as ResumeAnalysis,
    jd: jd?.parsedJson ?? null,
    gap: (parsed.data.gap as GapAnalysis | undefined) ?? null,
    difficulty: parsed.data.difficulty,
    durationMinutes: parsed.data.durationMinutes,
    interviewType: parsed.data.interviewType,
    customInstructions: parsed.data.customInstructions,
    // First name only — "walk me through your background, Priya Sharma
    // Reddy" reads like a form letter; a real interviewer uses the name
    // they'd actually say out loud.
    candidateName: session.user.name?.split(" ")[0] ?? "there",
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

  try {
    await applyCreditDelta(session.user.id, -CREDIT_COSTS.interview_plan, "interview_plan", interview.id);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      // Extremely narrow race: a concurrent request drained the balance
      // between the pre-flight check and this charge, after the interview
      // was already fully created. The interview is real and the user
      // already got value from it — crashing the request here would strand
      // them with a half-created interview they can't see and a scary
      // error, which is exactly what this product's design principles rule
      // out. Let it through uncharged rather than fail; new interview
      // creation is still blocked at balance <= 0 regardless.
      console.warn(`[interviews] plan charge failed for interview ${interview.id}: ${err.message}`);
    } else {
      throw err;
    }
  }

  return NextResponse.json({
    id: interview.id,
    topic: plan.topics[0].topic,
    question: plan.openingQuestion,
    totalTopics: plan.topics.length,
  });
}
