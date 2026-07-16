import { redirect } from "next/navigation";
import { db, users } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

import { ProfileTabs } from "./profile-tabs";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
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
      <div className="flex flex-col gap-6 max-w-4xl">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl font-heading">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your profile details, tokens, and credentials.</p>
        </div>

        <div className="flex flex-col gap-5">
          <ProfileTabs />
          <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-6">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}

