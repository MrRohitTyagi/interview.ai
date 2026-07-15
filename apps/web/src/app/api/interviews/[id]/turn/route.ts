import { NextResponse } from "next/server";
import {
  InterviewNotFoundError,
  InterviewNotInProgressError,
  InterviewStateError,
  processInterviewTurn,
} from "@ai-interviewer/orchestrator";
import { z } from "zod";

import { auth } from "@/lib/auth";

const bodySchema = z.object({
  answer: z.string().min(1).max(10000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: interviewId } = await params;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await processInterviewTurn(interviewId, session.user.id, parsed.data.answer);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InterviewNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof InterviewNotInProgressError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof InterviewStateError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }
}
