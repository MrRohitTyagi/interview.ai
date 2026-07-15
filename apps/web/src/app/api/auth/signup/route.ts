import { NextResponse } from "next/server";
import { db, users } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { hashPassword } from "@/lib/password";
import { requestOtp } from "@/lib/otp";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(200),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

// Creates the account (or, if a previous signup was never verified, updates
// it) with emailVerified left null, then sends a verification code. The
// account can't sign in until /api/auth/verify-email clears that field —
// see the emailVerified check in auth.ts's authorize().
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing?.emailVerified) {
    return NextResponse.json(
      { error: "An account with this email already exists — sign in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  if (existing) {
    // Signed up before but never verified — let them retry with a fresh
    // password/name rather than being stuck on a dead email.
    await db.update(users).set({ name, passwordHash }).where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({ name, email, passwordHash, emailVerified: null });
  }

  await requestOtp(email);

  return NextResponse.json({ ok: true });
}
