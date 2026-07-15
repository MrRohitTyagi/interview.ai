import { NextResponse } from "next/server";
import { db, resumes } from "@ai-interviewer/db";

import { auth } from "@/lib/auth";
import { extractResumeText, ScannedPdfError } from "@/lib/extract-text";
import { uploadResumeFile } from "@/lib/storage";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// Just uploads and extracts text — no Claude call here. Analysis is deferred
// to a single combined /api/analyze step once the user is ready (resume
// alone, or resume + JD together).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only PDF and DOCX files are supported" },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File must be under 5MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    text = await extractResumeText(buffer, file.type);
  } catch (err) {
    if (err instanceof ScannedPdfError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  const { path } = await uploadResumeFile({
    userId: session.user.id,
    fileName: file.name,
    contentType: file.type,
    buffer,
  });

  const [resume] = await db
    .insert(resumes)
    .values({
      userId: session.user.id,
      url: path,
      fileName: file.name,
      rawText: text,
      embeddingStatus: "pending",
    })
    .returning();

  return NextResponse.json({ id: resume.id, fileName: file.name });
}
