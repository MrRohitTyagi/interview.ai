import { and, eq, sql } from "drizzle-orm";

import { db } from "./client";
import { creditTransactions, users } from "./schema";

export class InsufficientCreditsError extends Error {
  constructor(
    public needed: number,
    public balance: number
  ) {
    super(`Not enough credits: need ${needed}, have ${balance}`);
  }
}

export type CreditReason =
  | "resume_analysis"
  | "jd_analysis"
  | "gap_analysis"
  | "interview_plan"
  | "interview_turn"
  | "report_generation"
  | "ai_code_review"
  | "signup_grant"
  | "redeem_code"
  | "admin_grant";

// Weighted roughly by real model cost (Opus > Sonnet > Haiku) and call
// frequency — see Token.LLD.md Section 4 for the full reasoning.
export const CREDIT_COSTS = {
  resume_analysis: 2,
  jd_analysis: 2,
  gap_analysis: 3,
  interview_plan: 5,
  interview_turn: 5,
  report_generation: 15,
  ai_code_review: 5,
} as const satisfies Partial<Record<CreditReason, number>>;

export const SIGNUP_GRANT_CREDITS = 220;

/**
 * The one write path for every credit change, charge or grant. Runs the
 * balance update as a single atomic UPDATE...WHERE...RETURNING — the WHERE
 * clause itself enforces "never go negative", which is what makes two
 * concurrent requests (e.g. two browser tabs) unable to race each other
 * into a negative balance. The ledger row is inserted in the same
 * transaction, so balance and history can never drift apart. Throws
 * InsufficientCreditsError (nothing written) if a negative delta would
 * take the balance below zero.
 */
export async function applyCreditDelta(
  userId: string,
  delta: number,
  reason: CreditReason,
  interviewId?: string
): Promise<number> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} + ${delta}` })
      .where(and(eq(users.id, userId), sql`${users.creditBalance} + ${delta} >= 0`))
      .returning({ creditBalance: users.creditBalance });

    if (!updated) {
      const [current] = await tx
        .select({ creditBalance: users.creditBalance })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      throw new InsufficientCreditsError(-delta, current?.creditBalance ?? 0);
    }

    await tx.insert(creditTransactions).values({
      userId,
      delta,
      reason,
      interviewId: interviewId ?? null,
      balanceAfter: updated.creditBalance,
    });

    return updated.creditBalance;
  });
}

// Expected-case cost of an interview at this topic count — deliberately not
// a worst-case ceiling (every topic maxing its follow-up cap), since that
// would routinely block users who'd actually have been fine. Assumes an
// average of 1 follow-up per topic (2 turns/topic: opening question, one
// follow-up). See Token.LLD.md Section 4's worked example.
export function estimateInterviewCost(topicCount: number): number {
  return CREDIT_COSTS.interview_plan + topicCount * 2 * CREDIT_COSTS.interview_turn + CREDIT_COSTS.report_generation;
}
