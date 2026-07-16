import { redirect } from "next/navigation";
import { db, users } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

import { JobsBoard } from "./jobs-board";

export default async function JobsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const [currentUser] = await db
    .select({ creditBalance: users.creditBalance })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <AppShell
      credits={currentUser?.creditBalance ?? 0}
      userName={session.user.name}
      userRole={session.user.role}
    >
      <div className="flex flex-col gap-6 max-w-5xl">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl font-heading">
            Job Board
          </h1>
          <p className="text-muted-foreground text-sm">
            Live openings aggregated from company career boards. Pick one and rehearse
            an interview built around its exact job description.
          </p>
        </div>

        <JobsBoard />
      </div>
    </AppShell>
  );
}
