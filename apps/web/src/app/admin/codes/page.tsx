import Link from "next/link";
import { redirect } from "next/navigation";
import { db, redeemCodes } from "@ai-interviewer/db";
import { desc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";

import { CreateCodeForm } from "./create-code-form";

export default async function AdminCodesPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (session.user.role !== "admin") redirect("/dashboard");

  const codes = await db.select().from(redeemCodes).orderBy(desc(redeemCodes.createdAt));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Redeem codes</h1>
        <CreateCodeForm />
      </div>

      <div className="studio-panel flex flex-col divide-y divide-border rounded-md">
        {codes.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No codes yet.</p>
        ) : (
          codes.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-mono font-medium">{c.code}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {c.credits} credits · {c.usedCount}/{c.maxUses} used
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
