"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, Coins, KeyRound, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { signOutAction } from "./actions";

const NAV_ITEMS = [
  { href: "/profile", label: "Account", icon: CircleUser },
  { href: "/profile/credits", label: "Credits", icon: Coins },
  { href: "/profile/security", label: "Security", icon: KeyRound },
] as const;

// The one nav surface in this app that isn't a page — every other route is
// single-purpose, but "profile" is genuinely a set of sibling sections a
// candidate moves between, so it earns the sidebar pattern product surfaces
// are explicitly permitted to reach for (reference/product.md: "Standard
// navigation patterns: top bar + side nav, breadcrumbs, tabs").
export function ProfileSidebar({
  userName,
  userEmail,
}: {
  userName?: string | null;
  userEmail?: string | null;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 flex-col gap-1 sm:w-52">
      <div className="mb-1 px-2.5">
        <p className="truncate text-sm font-medium">{userName ?? "Your account"}</p>
        {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="mt-2 border-t border-border pt-2 sm:mt-4">
        <form action={signOutAction}>
          <Button variant="outline" size="sm" type="submit" className="w-full justify-start gap-2">
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </form>
      </div>
    </nav>
  );
}
