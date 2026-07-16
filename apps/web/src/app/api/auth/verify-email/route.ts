import { NextResponse } from "next/server";
import { applyCreditDelta, db, SIGNUP_GRANT_CREDITS, users } from "@ai-interviewer/db";
import { and, eq, isNull } from "drizzle-orm";
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

  // Atomic claim: only matches a row that is still unverified, and RETURNING
  // tells us whether *this* request was the one that actually flipped it —
  // not a separate read-then-write, which two near-simultaneous requests
  // (double-click, client retry, two valid OTPs from two "resend" calls)
  // could both pass and both grant credits for.
  const [claimed] = await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(and(eq(users.id, user.id), isNull(users.emailVerified)))
    .returning({ id: users.id });

  if (claimed) {
    await applyCreditDelta(user.id, SIGNUP_GRANT_CREDITS, "signup_grant");
  }

  return NextResponse.json({ ok: true });
}
