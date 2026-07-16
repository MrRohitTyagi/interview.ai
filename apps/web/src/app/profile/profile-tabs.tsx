"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, Coins, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/profile", label: "Account Details", icon: CircleUser },
  { href: "/profile/credits", label: "Credits & Billing", icon: Coins },
  { href: "/profile/security", label: "Security & Credentials", icon: KeyRound },
] as const;

export function ProfileTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1.5 border-b border-border/60 pb-3 overflow-x-auto">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider font-mono transition-colors shrink-0",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
