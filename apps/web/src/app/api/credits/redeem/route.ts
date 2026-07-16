import { NextResponse } from "next/server";
import { applyCreditDelta, db, redeemCodes, redeemCodeUses } from "@ai-interviewer/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";

const bodySchema = z.object({
  code: z.string().trim().min(1).max(64),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const userId = session.user.id;
  const codeText = parsed.data.code.toUpperCase();

  let credits: number;
  try {
    // Validating the code and recording its use are one atomic unit — the
    // unique(codeId, userId) constraint on redeem_code_uses is what makes a
    // concurrent double-submit of the same code by the same user impossible.
    // The actual credit grant (applyCreditDelta, below) is deliberately a
    // separate call rather than nested in this transaction: applyCreditDelta
    // always opens its own top-level transaction, and nesting would mean two
    // transactions both touching this user's balance row on different
    // connections — a lock wait against itself, not a savepoint. A grant
    // (positive delta) can only fail on a genuine DB/infra error, an
    // acceptable small window for a testing-phase system.
    credits = await db.transaction(async (tx) => {
      const [redeemCode] = await tx.select().from(redeemCodes).where(eq(redeemCodes.code, codeText)).limit(1);
      if (!redeemCode) throw new Error("That code isn't valid.");
      if (redeemCode.usedCount >= redeemCode.maxUses) throw new Error("That code has already been fully redeemed.");

      const [existingUse] = await tx
        .select()
        .from(redeemCodeUses)
        .where(and(eq(redeemCodeUses.codeId, redeemCode.id), eq(redeemCodeUses.userId, userId)))
        .limit(1);
      if (existingUse) throw new Error("You've already redeemed this code.");

      await tx.insert(redeemCodeUses).values({ codeId: redeemCode.id, userId });
      await tx
        .update(redeemCodes)
        .set({ usedCount: redeemCode.usedCount + 1 })
        .where(eq(redeemCodes.id, redeemCode.id));

      return redeemCode.credits;
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to redeem code" },
      { status: 400 }
    );
  }

  const balance = await applyCreditDelta(userId, credits, "redeem_code");
  return NextResponse.json({ ok: true, credited: credits, balance });
}
