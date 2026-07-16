import { CircleUser } from "lucide-react";

import { auth } from "@/lib/auth";

export default async function ProfileAccountPage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground">Your basic account details.</p>
      </div>

      <div className="studio-panel flex flex-col divide-y divide-border rounded-md">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CircleUser className="size-3.5" />
            Name
          </span>
          <span className="font-medium">{session?.user?.name ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium">{session?.user?.email ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}
