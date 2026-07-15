import { NextResponse } from "next/server";
import { db, interviews } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";

// Cancelling is a hard stop, not a pause — there's no "resume later" state.
// Marks the interview abandoned so it shows up honestly in history instead
// of looking stuck "in progress" forever.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: interviewId } = await params;

  const [interview] = await db.select().from(interviews).where(eq(interviews.id, interviewId)).limit(1);
  if (!interview || interview.userId !== session.user.id) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }
  if (interview.status !== "in_progress" && interview.status !== "planned") {
    return NextResponse.json({ error: "Interview isn't active" }, { status: 400 });
  }

  await db
    .update(interviews)
    .set({ status: "abandoned", completedAt: new Date() })
    .where(eq(interviews.id, interviewId));

  return NextResponse.json({ ok: true });
}
