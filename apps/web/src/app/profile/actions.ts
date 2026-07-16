"use server";

import { revalidatePath } from "next/cache";

import { signOut } from "@/lib/auth";

// Split into its own file so the sidebar (a client component, needed for
// active-link highlighting via usePathname) can still submit a real server
// action for sign-out — a client component can't declare "use server" forms
// inline the way a server component page can.
export async function signOutAction() {
  // Without this, Next's client-side Router Cache can keep serving the
  // dashboard's stale "Welcome back, <name>" RSC payload after sign-out —
  // the session cookie is cleared, but the cached render isn't, so
  // navigating back to /dashboard can show the old signed-in content until
  // a hard reload. Busting the whole tree here (before the redirect below,
  // since signOut() itself throws to perform the redirect and nothing after
  // it would run) forces every route to re-render fresh next time it's
  // visited.
  revalidatePath("/", "layout");
  await signOut({ redirectTo: "/" });
}
