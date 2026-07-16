import { redirect } from "next/navigation";
import { db, users, codingAttempts } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { CodingClient } from "./coding-client";

export default async function CodingPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const userId = session.user.id;
  const [currentUser] = await db.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1);

  const userAttempts = await db.select({
     questionId: codingAttempts.questionId,
     status: codingAttempts.status,
     aiScore: codingAttempts.aiScore
  }).from(codingAttempts).where(eq(codingAttempts.userId, userId));

  const initialCompleted: Record<string, boolean> = {};
  for (const attempt of userAttempts) {
     if (attempt.status === "success" || attempt.aiScore === 10 || attempt.aiScore === 100) {
        initialCompleted[attempt.questionId] = true;
     }
  }

  return (
    <AppShell
      credits={currentUser?.creditBalance ?? 0}
      userName={session.user.name}
      userRole={session.user.role}
    >
      <CodingClient initialCompleted={initialCompleted} />
    </AppShell>
  );
}
