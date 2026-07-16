import { creditTransactions, db, users } from "@ai-interviewer/db";
import { desc, eq } from "drizzle-orm";
import { Coins } from "lucide-react";

import { auth } from "@/lib/auth";

import { CreditHistory } from "./credit-history";
import { RedeemCodeForm } from "./redeem-code-form";

export default async function ProfileCreditsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [[user], transactions] = await Promise.all([
    db.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, session.user.id)).limit(1),
    db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, session.user.id))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(20),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <p className="text-muted-foreground">Your balance, redeem codes, and recent activity.</p>
      </div>

      <div className="studio-panel studio-glow flex flex-col items-center gap-1 rounded-md py-6 text-center">
        <span className="flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
          <Coins className="size-3.5 text-primary" />
          Credit balance
        </span>
        <span className="font-mono text-4xl font-semibold tabular-nums">{user?.creditBalance ?? 0}</span>
      </div>

      <RedeemCodeForm />
      <CreditHistory transactions={transactions} />
    </div>
  );
}
