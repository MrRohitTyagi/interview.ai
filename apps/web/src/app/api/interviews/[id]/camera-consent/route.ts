import { NextResponse } from "next/server";
import { consentLogs, db, interviews } from "@ai-interviewer/db";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";

// Lets the camera panel know whether this user has EVER consented before
// (any interview, not just this one) — so a returning candidate isn't
// re-asked every single session. Still opt-in, just remembered.
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

  const [priorConsent] = await db
    .select()
    .from(consentLogs)
    .where(and(eq(consentLogs.userId, session.user.id), eq(consentLogs.cameraConsent, true)))
    .limit(1);

  return NextResponse.json({ hasConsented: !!priorConsent });
}

// Logs explicit camera consent per interview (LLD Section 11 / 13). Camera
// itself is entirely client-side — this endpoint only ever records the
// boolean consent flag, never any video or derived attention data.
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

  await db.insert(consentLogs).values({
    userId: session.user.id,
    interviewId,
    cameraConsent: true,
  });

  return NextResponse.json({ ok: true });
}
