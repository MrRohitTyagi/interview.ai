"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Mic,
  Sheet,
  Coins,
  CircleUser,
  ShieldAlert,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  credits?: number;
  userName?: string | null;
  userRole?: string;
}

export function AppShell({ children, credits = 0, userName = "User", userRole = "candidate" }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Load and persist sidebar collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      category: "Workspace",
    },
    {
      name: "Take Mock Interview",
      href: "/interview/new",
      icon: Mic,
      category: "Workspace",
    },
    {
      name: "Resume & JD Fit",
      href: "/analyze",
      icon: Sheet,
      category: "Workspace",
    },
    {
      name: "Interview Logs",
      href: "/history",
      icon: History,
      category: "Workspace",
    },
    {
      name: "Profile Settings",
      href: "/profile",
      icon: CircleUser,
      category: "Account",
    },
    {
      name: "Credits & Billing",
      href: "/profile/credits",
      icon: Coins,
      category: "Account",
    },
    {
      name: "Security",
      href: "/profile/security",
      icon: ShieldAlert,
      category: "Account",
    },
  ];

  const categories = ["Workspace", "Account"];

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/sign-in" });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-card text-card-foreground">
      <div className="flex flex-col gap-6 px-4 py-6">
        {/* Brand Logo */}
        <div className={cn("px-2 transition-all", collapsed && "flex flex-col items-center")}>
          {collapsed ? (
            <Link href="/" className="font-serif text-xl font-bold tracking-tight text-primary">
              i<span className="text-foreground">.</span>
            </Link>
          ) : (
            <>
              <Link href="/" className="font-serif text-xl font-medium tracking-tight text-foreground">
                interview<span className="accent-text font-semibold text-primary">.ai</span>
              </Link>
              <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                Mock Studio v2.0
              </div>
            </>
          )}
        </div>

        {/* User Credit Indicator Widget */}
        <Link href="/profile/credits" className="group block" title={`Credits: ${credits} CR`}>
          {collapsed ? (
            <div className="flex size-9 items-center justify-center rounded-xl border border-border bg-background/50 hover:border-primary/40 hover:studio-glow transition-all mx-auto">
              <Coins className="size-4.5 text-primary animate-pulse" />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3 transition-all hover:border-primary/40 hover:studio-glow">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Coins className="size-4 animate-pulse" />
                </div>
                <div className="text-left">
                  <div className="font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                    Available Credits
                  </div>
                  <div className="font-mono text-sm font-semibold tracking-tight">
                    {credits} CR
                  </div>
                </div>
              </div>
            </div>
          )}
        </Link>

        {/* Navigation Groups */}
        <nav className="flex flex-col gap-5">
          {categories.map((category) => (
            <div key={category} className="flex flex-col gap-1">
              {!collapsed && (
                <span className="px-2 font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                  {category}
                </span>
              )}
              <div className="flex flex-col gap-0.5">
                {navigation
                  .filter((item) => item.category === category)
                  .map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.name}
                        className={cn(
                          "group flex items-center rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
                          collapsed ? "justify-center" : "gap-3",
                          isActive
                            ? "bg-secondary text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-6 items-center justify-center rounded-md transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-background border border-border text-muted-foreground group-hover:text-foreground"
                          )}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        {!collapsed && <span className="flex-1">{item.name}</span>}
                        {isActive && !collapsed && (
                          <motion.div
                            layoutId="activeIndicator"
                            className="size-1.5 rounded-full bg-primary"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}

          {/* Admin panel link if applicable */}
          {userRole === "admin" && (
            <div className="flex flex-col gap-1">
              {!collapsed && (
                <span className="px-2 font-mono text-[0.62rem] uppercase tracking-wider text-muted-foreground">
                  Admin Settings
                </span>
              )}
              <Link
                href="/admin/codes"
                title="Promo Codes"
                className={cn(
                  "flex items-center rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
                  collapsed ? "justify-center" : "gap-3",
                  pathname.startsWith("/admin")
                    ? "bg-secondary text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                )}
              >
                <div className="flex size-6 items-center justify-center rounded-md bg-background border border-border">
                  <ShieldAlert className="size-3.5" />
                </div>
                {!collapsed && <span>Promo Codes</span>}
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* Sidebar Footer User Details */}
      <div className="border-t border-border p-4">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-muted-foreground" title={userName || "Profile"}>
              <CircleUser className="size-4" />
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
            <Button
              onClick={toggleCollapse}
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:bg-secondary"
              title="Expand Sidebar"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-border text-muted-foreground">
                <CircleUser className="size-4" />
              </div>
              <div className="min-w-0 text-left">
                <div className="truncate text-xs font-semibold text-foreground">
                  {userName?.split(" ")[0] || "User"}
                </div>
                <div className="truncate text-[0.62rem] text-muted-foreground uppercase font-mono">
                  {userRole}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                onClick={toggleCollapse}
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground hover:bg-secondary"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="icon"
                className="size-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className={cn("hidden h-full shrink-0 border-r border-border lg:block transition-all duration-300", collapsed ? "w-16" : "w-60")}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-60 flex-col border-r border-border bg-card animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header Bar */}
        <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <Button
            onClick={() => setMobileOpen(true)}
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Open menu"
          >
            <Menu className="size-4.5" />
          </Button>
          <Link href="/dashboard" className="font-serif text-sm font-semibold tracking-tight text-foreground">
            interview<span className="text-primary font-bold">.ai</span>
          </Link>
          <div className="w-8" /> {/* Spacer */}
        </header>

        {/* Scrollable Container */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 lg:p-10 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
