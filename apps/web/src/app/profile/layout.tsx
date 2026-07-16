import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";

import { ProfileSidebar } from "./profile-sidebar";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6 sm:p-10">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:gap-10">
        <ProfileSidebar userName={session.user.name} userEmail={session.user.email} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
