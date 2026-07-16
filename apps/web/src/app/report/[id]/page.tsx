import { notFound } from "next/navigation";
import { db, interviews, reports, questions, answers } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";

import { ReportView, type ReportData } from "@/app/interview/[id]/report/report-view";

export default async function PublicReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [interview] = await db.select().from(interviews).where(eq(interviews.id, id)).limit(1);
  if (!interview || interview.status !== "completed") notFound();

  const [report] = await db.select().from(reports).where(eq(reports.interviewId, id)).limit(1);
  
  // Public routes only show fully completed/ready reports
  if (!report || report.status !== "ready") notFound();

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-center">
         <div className="font-serif text-xl font-medium tracking-tight text-foreground">
            interview<span className="font-semibold text-primary">.ai</span>
         </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <ReportView 
          interviewId={id} 
          initialReport={(report as ReportData | undefined) ?? null} 
          fillerWordsCount={fillerWordsCount} 
          isPublic={true} 
        />
      </main>
    </div>
  );
}
