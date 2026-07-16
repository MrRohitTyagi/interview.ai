import { notFound, redirect } from "next/navigation";
import { db, interviews, reports, questions, answers } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";

import { ReportView, type ReportData } from "./report-view";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const { id } = await params;

  const [interview] = await db.select().from(interviews).where(eq(interviews.id, id)).limit(1);
  if (!interview || interview.userId !== session.user.id) notFound();
  if (interview.status !== "completed") redirect(`/interview/${id}`);

  const [report] = await db.select().from(reports).where(eq(reports.interviewId, id)).limit(1);

  const allAnswers = await db
    .select({ transcript: answers.transcript })
    .from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(eq(questions.interviewId, id));

  let fillerWordsCount = 0;
  const fillerRegex = /\b(um|uh|like|you know|basically|literally|actually|i mean)\b/gi;
  for (const a of allAnswers) {
    if (a.transcript) {
      const matches = a.transcript.match(fillerRegex);
      if (matches) fillerWordsCount += matches.length;
    }
  }

  return <ReportView interviewId={id} initialReport={(report as ReportData | undefined) ?? null} fillerWordsCount={fillerWordsCount} />;
}
