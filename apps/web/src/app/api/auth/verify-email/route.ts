import { NextResponse } from "next/server";
import { db, users } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { verifyOtp } from "@/lib/otp";

const bodySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(1),
});

// Marks the account verified once the emailed code checks out. The client
// still has to call signIn() itself afterward — this route only clears the
// gate, it doesn't establish a session.
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email, code } = parsed.data;

  const isValid = await verifyOtp(email, code);
  if (!isValid) {
    return NextResponse.json({ error: "That code is invalid or expired." }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
