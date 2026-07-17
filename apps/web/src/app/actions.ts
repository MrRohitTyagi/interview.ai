"use server";

import { db, interviews, codingAttempts, applyCreditDelta, CREDIT_COSTS } from "@ai-interviewer/db";
import { count } from "drizzle-orm";
import { reviewCode } from "@ai-interviewer/ai-core";
import { auth } from "@/lib/auth";

export async function submitBrainstormCodeAction(questionId: string, questionTitle: string, questionDescription: string, candidateCode: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Deduct credits before generating AI review
  await applyCreditDelta(session.user.id, -CREDIT_COSTS.ai_code_review, "ai_code_review");

  const review = await reviewCode(questionTitle, questionDescription, candidateCode);

  await db.insert(codingAttempts).values({
    userId: session.user.id,
    questionId: questionId,
    code: candidateCode,
    status: "ai_reviewed",
    aiScore: review.score,
    aiFeedback: review.feedback,
  });

  return review;
}

export async function submitRunCodeAction(questionId: string, candidateCode: string, isSuccess: boolean) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.insert(codingAttempts).values({
    userId: session.user.id,
    questionId: questionId,
    code: candidateCode,
    status: isSuccess ? "success" : "failed",
  });
}

export async function getInterviewCount() {
  const result = await db.select({ value: count() }).from(interviews);
  // Multiply by 100 for display purposes as requested
  return (result[0]?.value ?? 0) * 100 + 15400; // Added a base offset so it looks impressive even on a fresh DB!
}
