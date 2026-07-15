import { notFound, redirect } from "next/navigation";
import { db, interviews, reports } from "@ai-interviewer/db";
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

  return <ReportView interviewId={id} initialReport={(report as ReportData | undefined) ?? null} />;
}
