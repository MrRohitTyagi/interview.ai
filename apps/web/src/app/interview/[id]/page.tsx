import { notFound, redirect } from "next/navigation";
import { answers, db, interviews, questions } from "@ai-interviewer/db";
import { asc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";

import { VoiceChat } from "./voice-chat";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const { id } = await params;

  const [interview] = await db.select().from(interviews).where(eq(interviews.id, id)).limit(1);
  if (!interview || interview.userId !== session.user.id) notFound();

  const interviewQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.interviewId, id))
    .orderBy(asc(questions.order));

  const transcript = [];
  for (const q of interviewQuestions) {
    const [a] = await db.select().from(answers).where(eq(answers.questionId, q.id)).limit(1);
    transcript.push({ question: q.question, answer: a?.transcript ?? null, topic: q.topic });
  }

  return (
    <VoiceChat
      interviewId={interview.id}
      initialTranscript={transcript}
      initialCompleted={interview.status === "completed"}
      startedAt={interview.startedAt?.toISOString() ?? null}
      durationMinutes={interview.durationMinutes}
    />
  );
}
