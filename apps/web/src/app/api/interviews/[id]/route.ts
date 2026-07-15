import { NextResponse } from "next/server";
import { answers, db, interviews, questions } from "@ai-interviewer/db";
import { asc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: interviewId } = await params;

  const [interview] = await db.select().from(interviews).where(eq(interviews.id, interviewId)).limit(1);
  if (!interview || interview.userId !== session.user.id) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const interviewQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.interviewId, interviewId))
    .orderBy(asc(questions.order));

  const transcript = [];
  for (const q of interviewQuestions) {
    const [a] = await db.select().from(answers).where(eq(answers.questionId, q.id)).limit(1);
    transcript.push({ question: q.question, answer: a?.transcript ?? null, topic: q.topic });
  }

  return NextResponse.json({
    id: interview.id,
    status: interview.status,
    transcript,
  });
}

// Only cancelled (abandoned) interviews can be deleted — completed ones hold
// a real report worth keeping, and in-progress/planned ones should be ended
// first (cancel is the hard-stop path; delete is a separate, further step).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: interviewId } = await params;

  const [interview] = await db.select().from(interviews).where(eq(interviews.id, interviewId)).limit(1);
  if (!interview || interview.userId !== session.user.id) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }
  if (interview.status !== "abandoned") {
    return NextResponse.json({ error: "Only cancelled interviews can be deleted" }, { status: 400 });
  }

  // questions/answers/reports all cascade off interviews.id (onDelete: "cascade").
  await db.delete(interviews).where(eq(interviews.id, interviewId));

  return NextResponse.json({ ok: true });
}
