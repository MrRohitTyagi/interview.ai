import Link from "next/link";
import { redirect } from "next/navigation";
import { creditTransactions, db, users } from "@ai-interviewer/db";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Coins } from "lucide-react";

import { auth } from "@/lib/auth";

import { ChangePasswordForm } from "./change-password-form";
import { CreditHistory } from "./credit-history";
import { RedeemCodeForm } from "./redeem-code-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <div className="flex flex-col gap-4">
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

      <ChangePasswordForm />
    </div>
  );
}
