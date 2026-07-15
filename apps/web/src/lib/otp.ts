import {
  createHash,
  // randomInt
} from "node:crypto";

import { db, otpCodes } from "@ai-interviewer/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { Resend } from "resend";

const OTP_TTL_MINUTES = 10;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function requestOtp(email: string) {
  const code = "123456"; // || randomInt(0, 1_000_000).toString().padStart(6, "0"); //TODO
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.insert(otpCodes).values({
    email,
    codeHash: hashCode(code),
    expiresAt,
  });

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      to: email,
      subject: "Verify your email",
      text: `Your verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    });
  } else {
    // Development fallback: no RESEND_API_KEY configured yet.
    console.log(`[dev] OTP for ${email}: ${code}`);
  }
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const [record] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, email),
        eq(otpCodes.codeHash, hashCode(code)),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(otpCodes.createdAt)
    .limit(1);

  if (!record) return false;

  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(eq(otpCodes.id, record.id));
  return true;
}
