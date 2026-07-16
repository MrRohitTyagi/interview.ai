import { notFound, redirect } from "next/navigation";
import { answers, db, interviews, interviewStates, jobDescriptions, questions, resumes, users } from "@ai-interviewer/db";
import { asc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import type { ResumeAnalysis, JDAnalysis, PlannedTopic } from "@ai-interviewer/ai-core";

import { VoiceChat } from "./voice-chat";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const { id } = await params;

  const [interview] = await db.select().from(interviews).where(eq(interviews.id, id)).limit(1);
  if (!interview || interview.userId !== session.user.id) notFound();

  const [state] = await db.select().from(interviewStates).where(eq(interviewStates.interviewId, id)).limit(1);
  const [resume] = await db.select().from(resumes).where(eq(resumes.id, interview.resumeId)).limit(1);
  const jdResult = interview.jdId ? await db.select().from(jobDescriptions).where(eq(jobDescriptions.id, interview.jdId)).limit(1) : [];
  const jd = jdResult[0] ?? null;
  
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const candidateName = user?.name?.split(" ")[0] ?? "there";

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
      plan={(state?.plannedTopics as PlannedTopic[]) ?? []}
      resume={(resume?.parsedJson as ResumeAnalysis) ?? null}
      jd={(jd?.parsedJson as JDAnalysis) ?? null}
      candidateName={candidateName}
      interviewType={interview.type}
    />
  );
}
