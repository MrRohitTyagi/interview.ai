import { NextResponse } from "next/server";
import { db, resumes } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { getResumeSignedUrl } from "@/lib/storage";

// Short-lived signed URL so the candidate can preview/download the resume
// they uploaded — the storage bucket is private, so this is the only way
// to view the file short of re-uploading.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [resume] = await db.select().from(resumes).where(eq(resumes.id, id)).limit(1);
  if (!resume || resume.userId !== session.user.id) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const url = await getResumeSignedUrl(resume.url);
  return NextResponse.json({ url });
}
