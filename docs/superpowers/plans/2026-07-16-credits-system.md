# Credits System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the per-user credits system designed in `Token.LLD.md` — a credit ledger that meters every AI action, a redeem-code top-up flow, an admin code-generation page, and a `/profile` page (password change + credits), with a top-notch, design-system-consistent credits UI. The referral-program idea (per-user shareable codes, two-sided rewards) is explicitly **not** built — only the single admin-generated redeem-code mechanism.

**Architecture:** A cached `users.creditBalance` column plus an append-only `credit_transactions` ledger, written through one atomic function (`applyCreditDelta`) that can never push the balance negative. Every existing AI call site (resume/JD/gap analysis, interview planning, each interview turn, report generation) is wrapped with a charge immediately after its Claude call succeeds. Interview creation gets a pre-flight affordability check before any Claude call is made. New UI: `/profile` (password change, balance, redeem box, transaction history) and `/admin/codes` (code generation, role-gated).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Postgres (Supabase), NextAuth v5, Tailwind v4, existing "On Air" design system (`DESIGN.md`).

## Global Constraints

- **No test framework exists in this repo** (confirmed: zero `vitest`/`jest`/`*.test.ts`/`*.spec.ts` anywhere, no `test` script in any `package.json`). Do not introduce one as a side effect of this plan — that's a separate, undiscussed infrastructure decision. Every task's verification step below is instead: `tsc --noEmit`, `eslint` on the changed files, and a concrete manual verification recipe (curl against a running `next dev` + direct SQL against the dev database) — this mirrors the exact methodology already used throughout this project's development (sign up → verify → sign in → seed/query via a one-off script in `packages/db` → curl and inspect → clean up → kill the dev server). This is a deliberate adaptation to the codebase's real, established convention, not an oversight.
- **DB scripts need `DATABASE_URL`.** Any one-off Node script or `drizzle-kit` command run from `packages/db` must have the environment sourced first: `set -a && source apps/web/.env.local && set +a` (run from repo root before `cd`-ing, or use the absolute path to the env file). Never `echo`/`cat` that file — it contains a live Supabase password.
- **Dev server hygiene.** Before starting `next dev` for manual verification: `lsof -t -i:3000 | xargs -r kill -9`. Kill it again when verification for the task is done.
- **Vocabulary:** the currency is always called "credits" in code, UI copy, and API error messages — never "tokens" (this codebase already uses "tokens" to mean LLM tokens in comments; reusing that word for the currency would be confusing).
- **Design system:** every new UI surface follows `DESIGN.md`'s "On Air" system — flat `studio-panel` surfaces (never a drop shadow), the one Tally Amber accent only, mono/uppercase labels for data (`text-[0.62rem]`/`text-[0.68rem]` per the documented type ramp), no side-stripe (`border-l-2`/`border-r-2`) accents anywhere. Run `node /Users/rohittyagi/.claude/skills/impeccable/scripts/detect.mjs --json <files>` on every new/changed UI file before considering a UI task done, and fix any findings (or justify explicitly if a finding is a false positive).
- **Money-shaped numbers:** every credit amount displayed to a user is a plain `font-mono tabular-nums` integer — no currency symbol, no decimals (credits are always whole numbers in this design).

---

## File Structure

New files:
- `packages/db/src/credits.ts` — the ledger core: `applyCreditDelta`, `CREDIT_COSTS`, `SIGNUP_GRANT_CREDITS`, `estimateInterviewCost`, `InsufficientCreditsError`. Lives in `packages/db` because it's pure data-layer logic operating directly on the schema it ships next to — no new package for a function this size.
- `apps/web/src/app/api/credits/redeem/route.ts` — redeem a code.
- `apps/web/src/app/api/admin/codes/route.ts` — admin: create/list codes.
- `apps/web/src/app/admin/codes/page.tsx` + `apps/web/src/app/admin/codes/create-code-form.tsx` — admin codes UI.
- `apps/web/src/app/api/profile/password/route.ts` — change password.
- `apps/web/src/app/profile/page.tsx` — profile page shell (server component).
- `apps/web/src/app/profile/change-password-form.tsx` — client form.
- `apps/web/src/app/profile/redeem-code-form.tsx` — client form.
- `apps/web/src/app/profile/credit-history.tsx` — presentational transaction list.

Modified files:
- `packages/db/src/schema.ts` — `users.creditBalance`, `credit_reason` enum, `credit_transactions`, `redeem_codes`, `redeem_code_uses` tables + relations.
- `packages/db/src/index.ts` — re-export the new `credits.ts` surface.
- `packages/ai-core/src/interview-planner.ts` + `src/index.ts` — export `topicCountForDuration` (currently private) so the pre-flight check reuses the exact same formula instead of duplicating it.
- `apps/web/src/types/next-auth.d.ts` + `apps/web/src/lib/auth.ts` — thread `role` onto the session (needed for admin-gating; not currently present).
- `apps/web/src/app/api/auth/verify-email/route.ts` — signup grant.
- `apps/web/src/app/api/analyze/route.ts` — resume/JD/gap analysis charges + pre-flight.
- `apps/web/src/app/api/interviews/route.ts` — interview-plan charge + pre-flight.
- `packages/orchestrator/src/index.ts` — per-turn charge.
- `apps/web/src/app/api/interviews/[id]/report/route.ts` — report-generation charge.
- `apps/web/src/app/dashboard/page.tsx` — nav: Profile link, balance chip, conditional Admin link.

---

### Task 1: Schema — credits tables, migration

**Files:**
- Modify: `packages/db/src/schema.ts`

**Interfaces:**
- Produces: `users.creditBalance: number`, `creditReasonEnum`, `creditTransactions` table, `redeemCodes` table, `redeemCodeUses` table — all consumed by Task 3 (`credits.ts`) and later tasks.

- [ ] **Step 1: Add `unique` to the drizzle-orm/pg-core import**

In `packages/db/src/schema.ts`, change:

```ts
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
```

to:

```ts
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Add `creditBalance` to the `users` table**

Find:

```ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  // Nullable — OAuth-only accounts (if that path is ever re-enabled) never
  // set one. Salt+scrypt hash, stored as "salt:hash" hex, see lib/password.ts.
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("candidate"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Replace with:

```ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  // Nullable — OAuth-only accounts (if that path is ever re-enabled) never
  // set one. Salt+scrypt hash, stored as "salt:hash" hex, see lib/password.ts.
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("candidate"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  // The cached, fast-read balance — always kept in sync with
  // credit_transactions by applyCreditDelta (src/credits.ts), which is the
  // only code allowed to write to this column. See Token.LLD.md Section 3.
  creditBalance: integer("credit_balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: Add the credits section**

Insert this new section right before the `// Relations` section at the bottom of the file (after the `reports` table, before `export const usersRelations = ...`):

```ts
// ---------------------------------------------------------------------------
// Credits — see Token.LLD.md for the full design
// ---------------------------------------------------------------------------

export const creditReasonEnum = pgEnum("credit_reason", [
  "resume_analysis",
  "jd_analysis",
  "gap_analysis",
  "interview_plan",
  "interview_turn",
  "report_generation",
  "signup_grant",
  "redeem_code",
  "admin_grant",
]);

// Append-only — never updated or deleted. balanceAfter is a snapshot so
// history reads never need to recompute a running total.
export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: creditReasonEnum("reason").notNull(),
  interviewId: uuid("interview_id").references(() => interviews.id, { onDelete: "set null" }),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redeemCodes = pgTable("redeem_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  credits: integer("credits").notNull(),
  maxUses: integer("max_uses").notNull(),
  usedCount: integer("used_count").notNull().default(0),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redeemCodeUses = pgTable(
  "redeem_code_uses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => redeemCodes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.codeId, table.userId)]
);
```

- [ ] **Step 4: Add relations**

Find `export const usersRelations = relations(users, ({ many, one }) => ({` and add `creditTransactions: many(creditTransactions),` to its body, so it reads:

```ts
export const usersRelations = relations(users, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  resumes: many(resumes),
  jobDescriptions: many(jobDescriptions),
  interviews: many(interviews),
  creditTransactions: many(creditTransactions),
}));
```

Then add these three new relation exports at the end of the file:

```ts
export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, { fields: [creditTransactions.userId], references: [users.id] }),
  interview: one(interviews, { fields: [creditTransactions.interviewId], references: [interviews.id] }),
}));

export const redeemCodesRelations = relations(redeemCodes, ({ one, many }) => ({
  creator: one(users, { fields: [redeemCodes.createdBy], references: [users.id] }),
  uses: many(redeemCodeUses),
}));

export const redeemCodeUsesRelations = relations(redeemCodeUses, ({ one }) => ({
  code: one(redeemCodes, { fields: [redeemCodeUses.codeId], references: [redeemCodes.id] }),
  user: one(users, { fields: [redeemCodeUses.userId], references: [users.id] }),
}));
```

- [ ] **Step 5: Typecheck**

```bash
cd packages/db && node_modules/.bin/tsc --noEmit
```
Expected: no output (clean).

- [ ] **Step 6: Generate the migration**

```bash
cd packages/db && node_modules/.bin/drizzle-kit generate
```
Expected: a new file appears under `packages/db/drizzle/000N_<name>.sql` containing `CREATE TYPE "public"."credit_reason"`, `ALTER TABLE "users" ADD COLUMN "credit_balance"`, and `CREATE TABLE` statements for all three new tables. Read the generated SQL to confirm it matches — drizzle-kit occasionally needs a prompt answered interactively if it can't infer a rename; if it does, it's for the wrong reason, cancel and re-check Steps 1-4 for a typo before proceeding.

- [ ] **Step 7: Run the migration against the dev database**

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && node_modules/.bin/drizzle-kit migrate
```
Expected: "migrations applied successfully" (or equivalent drizzle-kit success output).

- [ ] **Step 8: Verify the schema landed**

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/verify-schema.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const cols = await sql`select column_name from information_schema.columns where table_name = 'users' and column_name = 'credit_balance'`;
const tables = await sql`select table_name from information_schema.tables where table_name in ('credit_transactions', 'redeem_codes', 'redeem_code_uses')`;
console.log("users.credit_balance present:", cols.length === 1);
console.log("new tables:", tables.map(t => t.table_name).sort());
await sql.end();
EOF
node /tmp/verify-schema.mjs && rm /tmp/verify-schema.mjs
```
Expected: `users.credit_balance present: true` and all three table names listed.

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "$(cat <<'EOF'
Add credits schema: users.creditBalance, credit_transactions ledger, redeem codes

Token.LLD.md Section 3 — schema-only change, no application logic yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Session role plumbing (needed for admin-gating)

The session currently only carries `user.id` — `role` was never threaded through. Every later admin-gated route needs `session.user.role`.

**Files:**
- Modify: `apps/web/src/types/next-auth.d.ts`
- Modify: `apps/web/src/lib/auth.ts`

**Interfaces:**
- Produces: `session.user.role: "candidate" | "recruiter" | "admin"`, consumed by Task 6 (admin codes) and Task 13 (dashboard admin link).

- [ ] **Step 1: Extend the type augmentation**

Replace the full contents of `apps/web/src/types/next-auth.d.ts` with:

```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "candidate" | "recruiter" | "admin";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "candidate" | "recruiter" | "admin";
  }
}
```

- [ ] **Step 2: Thread `role` through the callbacks**

In `apps/web/src/lib/auth.ts`, find:

```ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
```

Replace with:

```ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "candidate" | "recruiter" | "admin" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "candidate" | "recruiter" | "admin" | undefined) ?? "candidate";
      }
      return session;
    },
  },
```

(`user` in the `jwt` callback is the row returned by `authorize()` — a full Drizzle `users` row, which already has `role` on it; the cast is only needed because NextAuth's own `User` type doesn't know about it.)

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 4: Manual verification**

Start the dev server and sign in as an existing test user, then check the JWT-derived session carries the role:

```bash
lsof -t -i:3000 | xargs -r kill -9; cd apps/web && (nohup npx next dev > /tmp/next-dev.log 2>&1 &); sleep 6
```

Sign up, verify, and sign in a fresh user (reuse the pattern below throughout this plan):

```bash
EMAIL="e2e-role-$(date +%s)@example.com"; echo $EMAIL > /tmp/e2e-email.txt
curl -s -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"Role Tester\"}" -c /tmp/e2e-cookies.txt
sleep 1
CODE=$(grep "\[dev\] OTP for $EMAIL" /tmp/next-dev.log | tail -1 | grep -oE '[0-9]{6}$')
curl -s -X POST http://localhost:3000/api/auth/verify-email -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}"
CSRF=$(curl -s http://localhost:3000/api/auth/csrf -c /tmp/e2e-cookies.txt | grep -oE '"csrfToken":"[^"]+"' | cut -d'"' -f4)
curl -s -X POST http://localhost:3000/api/auth/callback/password -b /tmp/e2e-cookies.txt -c /tmp/e2e-cookies.txt \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=$EMAIL" --data-urlencode "password=TestPass123!" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "json=true" -w "\n%{http_code}\n"
curl -s http://localhost:3000/api/auth/session -b /tmp/e2e-cookies.txt
```
Expected: the final line is JSON containing `"role":"candidate"`. Clean up this test user before moving on (delete via SQL as done in later tasks, or leave it — Task 3's verification will create its own and Task 6 needs an admin user anyway, so keep the cookies/email files for now if continuing straight to Task 3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/types/next-auth.d.ts apps/web/src/lib/auth.ts
git commit -m "$(cat <<'EOF'
Thread role onto the session

Needed for admin-gating the codes page — role was previously only on
the users table, never surfaced past authorize().

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `packages/db/src/credits.ts` — the ledger core

**Files:**
- Create: `packages/db/src/credits.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Consumes: `db` (from `./client`), `users`, `creditTransactions` (from `./schema`, Task 1).
- Produces:
  - `applyCreditDelta(userId: string, delta: number, reason: CreditReason, interviewId?: string): Promise<number>` (returns new balance)
  - `estimateInterviewCost(topicCount: number): number`
  - `CREDIT_COSTS: { resume_analysis: 2, jd_analysis: 2, gap_analysis: 3, interview_plan: 5, interview_turn: 5, report_generation: 15 }`
  - `SIGNUP_GRANT_CREDITS: 220`
  - `class InsufficientCreditsError extends Error { needed: number; balance: number }`
  - `type CreditReason`

- [ ] **Step 1: Write `credits.ts`**

```ts
import { and, eq, sql } from "drizzle-orm";

import { db } from "./client";
import { creditTransactions, users } from "./schema";

export class InsufficientCreditsError extends Error {
  constructor(
    public needed: number,
    public balance: number
  ) {
    super(`Not enough credits: need ${needed}, have ${balance}`);
  }
}

export type CreditReason =
  | "resume_analysis"
  | "jd_analysis"
  | "gap_analysis"
  | "interview_plan"
  | "interview_turn"
  | "report_generation"
  | "signup_grant"
  | "redeem_code"
  | "admin_grant";

// Weighted roughly by real model cost (Opus > Sonnet > Haiku) and call
// frequency — see Token.LLD.md Section 4 for the full reasoning.
export const CREDIT_COSTS = {
  resume_analysis: 2,
  jd_analysis: 2,
  gap_analysis: 3,
  interview_plan: 5,
  interview_turn: 5,
  report_generation: 15,
} as const satisfies Partial<Record<CreditReason, number>>;

export const SIGNUP_GRANT_CREDITS = 220;

/**
 * The one write path for every credit change, charge or grant. Runs the
 * balance update as a single atomic UPDATE...WHERE...RETURNING — the WHERE
 * clause itself enforces "never go negative", which is what makes two
 * concurrent requests (e.g. two browser tabs) unable to race each other
 * into a negative balance. The ledger row is inserted in the same
 * transaction, so balance and history can never drift apart. Throws
 * InsufficientCreditsError (nothing written) if a negative delta would
 * take the balance below zero.
 */
export async function applyCreditDelta(
  userId: string,
  delta: number,
  reason: CreditReason,
  interviewId?: string
): Promise<number> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} + ${delta}` })
      .where(and(eq(users.id, userId), sql`${users.creditBalance} + ${delta} >= 0`))
      .returning({ creditBalance: users.creditBalance });

    if (!updated) {
      const [current] = await tx
        .select({ creditBalance: users.creditBalance })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      throw new InsufficientCreditsError(-delta, current?.creditBalance ?? 0);
    }

    await tx.insert(creditTransactions).values({
      userId,
      delta,
      reason,
      interviewId: interviewId ?? null,
      balanceAfter: updated.creditBalance,
    });

    return updated.creditBalance;
  });
}

// Expected-case cost of an interview at this topic count — deliberately not
// a worst-case ceiling (every topic maxing its follow-up cap), since that
// would routinely block users who'd actually have been fine. Assumes an
// average of 1 follow-up per topic (2 turns/topic: opening question, one
// follow-up). See Token.LLD.md Section 4's worked example.
export function estimateInterviewCost(topicCount: number): number {
  return CREDIT_COSTS.interview_plan + topicCount * 2 * CREDIT_COSTS.interview_turn + CREDIT_COSTS.report_generation;
}
```

- [ ] **Step 2: Re-export from the package index**

In `packages/db/src/index.ts`, change:

```ts
export * from "./schema";
export { db } from "./client";
```

to:

```ts
export * from "./schema";
export { db } from "./client";
export {
  applyCreditDelta,
  estimateInterviewCost,
  CREDIT_COSTS,
  SIGNUP_GRANT_CREDITS,
  InsufficientCreditsError,
  type CreditReason,
} from "./credits";
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/db && node_modules/.bin/tsc --noEmit
```
Expected: no output.

- [ ] **Step 4: Manual verification — grant, charge, and insufficient-balance paths**

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/verify-credits.mjs <<'EOF'
import { db, users, applyCreditDelta, InsufficientCreditsError } from "./src/index.ts";
import { eq } from "drizzle-orm";

const email = process.argv[2];
const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!user) { console.error("user not found"); process.exit(1); }

const afterGrant = await applyCreditDelta(user.id, 100, "admin_grant");
console.log("after +100 grant:", afterGrant, afterGrant === 100 ? "PASS" : "FAIL");

const afterCharge = await applyCreditDelta(user.id, -30, "interview_turn");
console.log("after -30 charge:", afterCharge, afterCharge === 70 ? "PASS" : "FAIL");

try {
  await applyCreditDelta(user.id, -1000, "interview_turn");
  console.log("FAIL: overdraft did not throw");
} catch (err) {
  console.log("overdraft correctly threw:", err instanceof InsufficientCreditsError ? "PASS" : "FAIL", err.message);
}

const [after] = await db.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, user.id)).limit(1);
console.log("balance unchanged after failed overdraft:", after.creditBalance === 70 ? "PASS" : "FAIL");

process.exit(0);
EOF
node --experimental-strip-types /tmp/verify-credits.mjs "$(cat /tmp/e2e-email.txt)"
rm /tmp/verify-credits.mjs
```

Expected: four `PASS` lines. (`node --experimental-strip-types` runs the `.ts` source directly without a build step — Node 22+ supports this; if the installed Node version is older, `cd packages/db && node_modules/.bin/tsc --outDir /tmp/credits-build src/credits.ts src/schema.ts src/client.ts src/index.ts && node /tmp/credits-build/verify-credits.mjs` is the fallback, adjusting the import path to the compiled output.)

This reuses the test user created in Task 2 Step 4 (`/tmp/e2e-email.txt`) — don't delete it yet if continuing to Task 4.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/credits.ts packages/db/src/index.ts
git commit -m "$(cat <<'EOF'
Add the credit ledger core: applyCreditDelta, cost table, estimator

The one write path for every credit change — atomic balance update
plus ledger insert in one transaction, per Token.LLD.md Section 3.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Signup grant

**Files:**
- Modify: `apps/web/src/app/api/auth/verify-email/route.ts`

**Interfaces:**
- Consumes: `applyCreditDelta`, `SIGNUP_GRANT_CREDITS` from `@ai-interviewer/db` (Task 3).

- [ ] **Step 1: Wire the grant, guarded against double-verification**

Replace the full contents of `apps/web/src/app/api/auth/verify-email/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { applyCreditDelta, db, SIGNUP_GRANT_CREDITS, users } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { verifyOtp } from "@/lib/otp";

const bodySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(1),
});

// Marks the account verified once the emailed code checks out. The client
// still has to call signIn() itself afterward — this route only clears the
// gate, it doesn't establish a session.
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email, code } = parsed.data;

  const isValid = await verifyOtp(email, code);
  if (!isValid) {
    return NextResponse.json({ error: "That code is invalid or expired." }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Grant only on the *first* verification — a user requesting a fresh OTP
  // and re-submitting it after already being verified must not re-grant.
  const alreadyVerified = !!user.emailVerified;

  await db.update(users).set({ emailVerified: new Date() }).where(eq(users.id, user.id));

  if (!alreadyVerified) {
    await applyCreditDelta(user.id, SIGNUP_GRANT_CREDITS, "signup_grant");
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 3: Manual verification**

```bash
lsof -t -i:3000 | xargs -r kill -9; cd apps/web && (nohup npx next dev > /tmp/next-dev.log 2>&1 &); sleep 6

EMAIL="e2e-grant-$(date +%s)@example.com"; echo $EMAIL > /tmp/e2e-email.txt
curl -s -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"Grant Tester\"}"
sleep 1
CODE=$(grep "\[dev\] OTP for $EMAIL" /tmp/next-dev.log | tail -1 | grep -oE '[0-9]{6}$')
curl -s -X POST http://localhost:3000/api/auth/verify-email -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}"
```

Then confirm the balance via a one-off script (same pattern as Task 3's verify script, but just a `select`):

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/check-balance.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = process.argv[2];
const [row] = await sql`select credit_balance from users where email = ${email}`;
const txns = await sql`select delta, reason from credit_transactions ct join users u on u.id = ct.user_id where u.email = ${email}`;
console.log("balance:", row.credit_balance, row.credit_balance === 220 ? "PASS" : "FAIL");
console.log("ledger rows:", txns, txns.length === 1 && txns[0].reason === "signup_grant" ? "PASS" : "FAIL");
await sql.end();
EOF
node /tmp/check-balance.mjs "$(cat /tmp/e2e-email.txt)" && rm /tmp/check-balance.mjs
```
Expected: two `PASS` lines.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/auth/verify-email/route.ts
git commit -m "$(cat <<'EOF'
Grant signup credits on first email verification

220 credits — roughly two default-length interviews, per
Token.LLD.md Section 4's worked example. Guarded against a
re-verification double-grant.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Redeem-code API route

**Files:**
- Create: `apps/web/src/app/api/credits/redeem/route.ts`

**Interfaces:**
- Consumes: `applyCreditDelta`, `db`, `redeemCodes`, `redeemCodeUses` from `@ai-interviewer/db`.
- Produces: `POST /api/credits/redeem { code: string } → { ok: true, credited: number, balance: number }`, consumed by Task 12's redeem form.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { applyCreditDelta, db, redeemCodes, redeemCodeUses } from "@ai-interviewer/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";

const bodySchema = z.object({
  code: z.string().trim().min(1).max(64),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const userId = session.user.id;
  const codeText = parsed.data.code.toUpperCase();

  let credits: number;
  try {
    // Validating the code and recording its use are one atomic unit — the
    // unique(codeId, userId) constraint on redeem_code_uses is what makes a
    // concurrent double-submit of the same code by the same user impossible.
    // The actual credit grant (applyCreditDelta, below) is deliberately a
    // separate call rather than nested in this transaction: applyCreditDelta
    // always opens its own top-level transaction, and nesting would mean two
    // transactions both touching this user's balance row on different
    // connections — a lock wait against itself, not a savepoint. A grant
    // (positive delta) can only fail on a genuine DB/infra error, an
    // acceptable small window for a testing-phase system.
    credits = await db.transaction(async (tx) => {
      const [redeemCode] = await tx.select().from(redeemCodes).where(eq(redeemCodes.code, codeText)).limit(1);
      if (!redeemCode) throw new Error("That code isn't valid.");
      if (redeemCode.usedCount >= redeemCode.maxUses) throw new Error("That code has already been fully redeemed.");

      const [existingUse] = await tx
        .select()
        .from(redeemCodeUses)
        .where(and(eq(redeemCodeUses.codeId, redeemCode.id), eq(redeemCodeUses.userId, userId)))
        .limit(1);
      if (existingUse) throw new Error("You've already redeemed this code.");

      await tx.insert(redeemCodeUses).values({ codeId: redeemCode.id, userId });
      await tx
        .update(redeemCodes)
        .set({ usedCount: redeemCode.usedCount + 1 })
        .where(eq(redeemCodes.id, redeemCode.id));

      return redeemCode.credits;
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to redeem code" },
      { status: 400 }
    );
  }

  const balance = await applyCreditDelta(userId, credits, "redeem_code");
  return NextResponse.json({ ok: true, credited: credits, balance });
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
cd apps/web && npx tsc --noEmit && npx eslint src/app/api/credits/redeem/route.ts
```
Expected: no output from either.

- [ ] **Step 3: Manual verification**

Seed a code directly (Task 6 will add the real admin UI for this), then exercise all three failure paths plus success:

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/seed-code.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = process.argv[2];
const [user] = await sql`select id from users where email = ${email}`;
const [code] = await sql`insert into redeem_codes (code, credits, max_uses, created_by) values ('TESTCODE1', 50, 1, ${user.id}) returning code`;
console.log("seeded", code.code);
await sql.end();
EOF
node /tmp/seed-code.mjs "$(cat /tmp/e2e-email.txt)"
```

```bash
# reuse the signed-in cookie jar from Task 4 (re-sign-in if it expired)
curl -s -X POST http://localhost:3000/api/credits/redeem -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" -d '{"code":"nonexistent"}' -w "\n%{http_code}\n"
curl -s -X POST http://localhost:3000/api/credits/redeem -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" -d '{"code":"testcode1"}' -w "\n%{http_code}\n"
curl -s -X POST http://localhost:3000/api/credits/redeem -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" -d '{"code":"testcode1"}' -w "\n%{http_code}\n"
```
Expected: first call 400 "not valid"; second call 200 with `"credited":50,"balance":270` (lowercase code matched via the route's `.toUpperCase()`); third call 400 "already redeemed" — confirming both the max-uses guard and the double-redeem guard.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/credits/redeem/route.ts
git commit -m "$(cat <<'EOF'
Add the redeem-code API route

Covers what was originally described as two separate features
("gift redeem" and "referral code") — one redeem mechanism,
admin-generated codes only. Token.LLD.md Section 5.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Admin codes API + page

**Files:**
- Create: `apps/web/src/app/api/admin/codes/route.ts`
- Create: `apps/web/src/app/admin/codes/page.tsx`
- Create: `apps/web/src/app/admin/codes/create-code-form.tsx`

**Interfaces:**
- Consumes: `session.user.role` (Task 2), `db`, `redeemCodes` (Task 1).
- Produces: `GET/POST /api/admin/codes`, page at `/admin/codes`.

- [ ] **Step 1: Write the API route**

```ts
// apps/web/src/app/api/admin/codes/route.ts
import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { db, redeemCodes } from "@ai-interviewer/db";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";

const bodySchema = z.object({
  code: z.string().trim().max(64).optional(),
  credits: z.number().int().min(1).max(10000),
  maxUses: z.number().int().min(1).max(100000),
});

function generateCode(): string {
  return randomBytes(6).toString("hex").toUpperCase();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const codes = await db.select().from(redeemCodes).orderBy(desc(redeemCodes.createdAt));
  return NextResponse.json(codes);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const code = (parsed.data.code || generateCode()).toUpperCase();

  const [created] = await db
    .insert(redeemCodes)
    .values({
      code,
      credits: parsed.data.credits,
      maxUses: parsed.data.maxUses,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(created);
}
```

- [ ] **Step 2: Write the client form**

```tsx
// apps/web/src/app/admin/codes/create-code-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("50");
  const [maxUses, setMaxUses] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || undefined,
          credits: Number(credits),
          maxUses: Number(maxUses),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create code");
      toast.success(`Code ${data.code} created`);
      setCode("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Code (optional)</Label>
        <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto-generated" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="credits">Credits</Label>
        <Input
          id="credits"
          type="number"
          min={1}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className="w-28"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="maxUses">Max uses</Label>
        <Input
          id="maxUses"
          type="number"
          min={1}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          className="w-28"
        />
      </div>
      <Button type="submit" disabled={submitting} className="gap-1.5">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Create code
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write the page**

```tsx
// apps/web/src/app/admin/codes/page.tsx
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
```

- [ ] **Step 4: Typecheck + lint**

```bash
cd apps/web && npx tsc --noEmit && npx eslint src/app/api/admin/codes/route.ts src/app/admin/codes/page.tsx src/app/admin/codes/create-code-form.tsx
```
Expected: no output.

- [ ] **Step 5: Design detector**

```bash
cd /Users/rohittyagi/Desktop/repos/ai-interviewer-app && node /Users/rohittyagi/.claude/skills/impeccable/scripts/detect.mjs --json apps/web/src/app/admin/codes/page.tsx apps/web/src/app/admin/codes/create-code-form.tsx
```
Expected: `[]`. Fix any findings before proceeding.

- [ ] **Step 6: Manual verification — non-admin blocked, admin succeeds**

```bash
# non-admin: expect 403
curl -s http://localhost:3000/api/admin/codes -b /tmp/e2e-cookies.txt -w "\n%{http_code}\n"

# promote the test user to admin directly (there's no self-serve promotion path — deliberate)
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/promote-admin.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
await sql`update users set role = 'admin' where email = ${process.argv[2]}`;
console.log("promoted", process.argv[2]);
await sql.end();
EOF
node /tmp/promote-admin.mjs "$(cat /tmp/e2e-email.txt)" && rm /tmp/promote-admin.mjs
```

Sign in again (role is baked into the JWT at sign-in time, so the existing session cookie still shows the old role until re-authenticated):

```bash
CSRF=$(curl -s http://localhost:3000/api/auth/csrf -c /tmp/e2e-cookies.txt | grep -oE '"csrfToken":"[^"]+"' | cut -d'"' -f4)
curl -s -X POST http://localhost:3000/api/auth/callback/password -b /tmp/e2e-cookies.txt -c /tmp/e2e-cookies.txt \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=$(cat /tmp/e2e-email.txt)" --data-urlencode "password=TestPass123!" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "json=true" -w "\n%{http_code}\n"

curl -s http://localhost:3000/api/admin/codes -b /tmp/e2e-cookies.txt -w "\n%{http_code}\n"
curl -s -X POST http://localhost:3000/api/admin/codes -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" \
  -d '{"credits":25,"maxUses":5}' -w "\n%{http_code}\n"
curl -s http://localhost:3000/admin/codes -b /tmp/e2e-cookies.txt -o /tmp/admin-codes.html -w "%{http_code}\n"
grep -o 'Redeem codes\|Create code' /tmp/admin-codes.html
```
Expected: first call 403; after promotion+re-sign-in, `GET`/`POST` both 200, the created code has an auto-generated `code` field (since none was supplied), and the page HTML contains both matched strings. Clean up `/tmp/admin-codes.html`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/admin/codes/ apps/web/src/app/admin/codes/
git commit -m "$(cat <<'EOF'
Add admin redeem-code generation page

Gated by the existing user_role "admin" value — no new permissions
system. Token.LLD.md Section 6.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Export `topicCountForDuration`

**Files:**
- Modify: `packages/ai-core/src/interview-planner.ts`
- Modify: `packages/ai-core/src/index.ts`

**Interfaces:**
- Produces: `topicCountForDuration(durationMinutes: number): number`, consumed by Task 8's pre-flight check.

- [ ] **Step 1: Export the function**

In `packages/ai-core/src/interview-planner.ts`, change:

```ts
function topicCountForDuration(durationMinutes: number): number {
```

to:

```ts
export function topicCountForDuration(durationMinutes: number): number {
```

- [ ] **Step 2: Re-export from the package index**

In `packages/ai-core/src/index.ts`, find the `interview-planner` export block:

```ts
export {
  generateInterviewPlan,
  interviewPlanSchema,
  interviewTypeSchema,
  plannedTopicSchema,
  type InterviewPlan,
  type InterviewType,
  type PlannedTopic,
} from "./interview-planner";
```

Add `topicCountForDuration,` to the list:

```ts
export {
  generateInterviewPlan,
  topicCountForDuration,
  interviewPlanSchema,
  interviewTypeSchema,
  plannedTopicSchema,
  type InterviewPlan,
  type InterviewType,
  type PlannedTopic,
} from "./interview-planner";
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/ai-core && node_modules/.bin/tsc --noEmit
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/ai-core/src/interview-planner.ts packages/ai-core/src/index.ts
git commit -m "$(cat <<'EOF'
Export topicCountForDuration

Needed so the interview-creation pre-flight credit check reuses the
exact same topic-count formula the planner itself uses, instead of
duplicating it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Interview creation — pre-flight check + plan charge

**Files:**
- Modify: `apps/web/src/app/api/interviews/route.ts`

**Interfaces:**
- Consumes: `applyCreditDelta`, `CREDIT_COSTS`, `estimateInterviewCost` (Task 3), `topicCountForDuration` (Task 7).

- [ ] **Step 1: Update imports**

Find:

```ts
import { NextResponse } from "next/server";
import {
  generateInterviewPlan,
  interviewTypeSchema,
  type GapAnalysis,
  type JDAnalysis,
  type ResumeAnalysis,
} from "@ai-interviewer/ai-core";
import { db, interviews, interviewStates, jobDescriptions, questions, resumes } from "@ai-interviewer/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";
```

Replace with:

```ts
import { NextResponse } from "next/server";
import {
  generateInterviewPlan,
  topicCountForDuration,
  interviewTypeSchema,
  type GapAnalysis,
  type JDAnalysis,
  type ResumeAnalysis,
} from "@ai-interviewer/ai-core";
import {
  applyCreditDelta,
  CREDIT_COSTS,
  db,
  estimateInterviewCost,
  interviews,
  interviewStates,
  jobDescriptions,
  questions,
  resumes,
  users,
} from "@ai-interviewer/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";
```

- [ ] **Step 2: Insert the pre-flight check**

Find (the JD lookup block, right before `const plan = await generateInterviewPlan({`):

```ts
  let jd: { id: string; parsedJson: JDAnalysis } | null = null;
  if (parsed.data.jdId) {
    const [jdRow] = await db
      .select()
      .from(jobDescriptions)
      .where(and(eq(jobDescriptions.id, parsed.data.jdId), eq(jobDescriptions.userId, session.user.id)))
      .limit(1);
    if (!jdRow || !jdRow.parsedJson) {
      return NextResponse.json({ error: "Job description not found or not analyzed" }, { status: 400 });
    }
    jd = { id: jdRow.id, parsedJson: jdRow.parsedJson as JDAnalysis };
  }

  const plan = await generateInterviewPlan({
```

Replace with:

```ts
  let jd: { id: string; parsedJson: JDAnalysis } | null = null;
  if (parsed.data.jdId) {
    const [jdRow] = await db
      .select()
      .from(jobDescriptions)
      .where(and(eq(jobDescriptions.id, parsed.data.jdId), eq(jobDescriptions.userId, session.user.id)))
      .limit(1);
    if (!jdRow || !jdRow.parsedJson) {
      return NextResponse.json({ error: "Job description not found or not analyzed" }, { status: 400 });
    }
    jd = { id: jdRow.id, parsedJson: jdRow.parsedJson as JDAnalysis };
  }

  // Pre-flight affordability check — before any Claude call, so a request
  // that was always going to be rejected never spends anything. Uses the
  // same expected-case formula documented in Token.LLD.md Section 4.
  const estimatedTopicCount = topicCountForDuration(parsed.data.durationMinutes);
  const estimatedCost = estimateInterviewCost(estimatedTopicCount);
  const [currentUser] = await db
    .select({ creditBalance: users.creditBalance })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!currentUser || currentUser.creditBalance < estimatedCost) {
    return NextResponse.json(
      {
        error: "Not enough credits to start this interview",
        needed: estimatedCost,
        balance: currentUser?.creditBalance ?? 0,
      },
      { status: 402 }
    );
  }

  const plan = await generateInterviewPlan({
```

- [ ] **Step 3: Charge after the interview row exists**

Find:

```ts
  await db.insert(interviewStates).values({
    interviewId: interview.id,
    currentQuestionId: openingQuestion.id,
    remainingTimeSeconds: parsed.data.durationMinutes * 60,
    coveredTopics: [],
    weakTopics: [],
    plannedTopics: plan.topics,
    currentTopicIndex: 0,
    followUpsOnCurrentTopic: 0,
  });

  return NextResponse.json({
    id: interview.id,
    topic: plan.topics[0].topic,
    question: plan.openingQuestion,
    totalTopics: plan.topics.length,
  });
}
```

Replace with:

```ts
  await db.insert(interviewStates).values({
    interviewId: interview.id,
    currentQuestionId: openingQuestion.id,
    remainingTimeSeconds: parsed.data.durationMinutes * 60,
    coveredTopics: [],
    weakTopics: [],
    plannedTopics: plan.topics,
    currentTopicIndex: 0,
    followUpsOnCurrentTopic: 0,
  });

  await applyCreditDelta(session.user.id, -CREDIT_COSTS.interview_plan, "interview_plan", interview.id);

  return NextResponse.json({
    id: interview.id,
    topic: plan.topics[0].topic,
    question: plan.openingQuestion,
    totalTopics: plan.topics.length,
  });
}
```

- [ ] **Step 4: Typecheck + lint**

```bash
cd apps/web && npx tsc --noEmit && npx eslint src/app/api/interviews/route.ts
```
Expected: no output.

- [ ] **Step 5: Manual verification — both blocked and successful paths**

Drain the test user's balance to below the estimate, confirm the block, then top up and confirm success:

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/set-balance.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
await sql`update users set credit_balance = ${Number(process.argv[3])} where email = ${process.argv[2]}`;
console.log("set balance to", process.argv[3]);
await sql.end();
EOF
node /tmp/set-balance.mjs "$(cat /tmp/e2e-email.txt)" 10
```

You'll need an analyzed resume to reference — seed one directly (same pattern used throughout this project's development):

```bash
cat > /tmp/seed-resume.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = process.argv[2];
const [user] = await sql`select id from users where email = ${email}`;
const parsedJson = { summary: "Test", skills: ["Node.js"], companies: [], projects: [], achievements: [], technologies: ["Node.js"], claims: [], strongAreas: [], weakAreas: [], suggestedTopics: [] };
const [resume] = await sql`insert into resumes (user_id, url, raw_text, parsed_json) values (${user.id}, 'https://example.com/r.pdf', 'seed', ${sql.json(parsedJson)}) returning id`;
console.log(resume.id);
await sql.end();
EOF
RESUME_ID=$(node /tmp/seed-resume.mjs "$(cat /tmp/e2e-email.txt)" | tail -1)

curl -s -X POST http://localhost:3000/api/interviews -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" \
  -d "{\"resumeId\":\"$RESUME_ID\",\"difficulty\":\"medium\",\"durationMinutes\":30,\"interviewType\":\"technical\"}" -w "\n%{http_code}\n"

node /tmp/set-balance.mjs "$(cat /tmp/e2e-email.txt)" 500
curl -s -X POST http://localhost:3000/api/interviews -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" \
  -d "{\"resumeId\":\"$RESUME_ID\",\"difficulty\":\"medium\",\"durationMinutes\":30,\"interviewType\":\"technical\"}" -o /tmp/iv.json -w "\n%{http_code}\n"
cat /tmp/iv.json

node /tmp/set-balance.mjs "$(cat /tmp/e2e-email.txt)" 999999 # remove the temp scripts when done
rm /tmp/set-balance.mjs /tmp/seed-resume.mjs
```
Expected: first call — 402, `"error":"Not enough credits to start this interview"`. Second call (after topping up) — 200 with a real interview `id`. Then confirm the charge:

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/check-plan-charge.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = process.argv[2];
const rows = await sql`select ct.delta, ct.reason from credit_transactions ct join users u on u.id = ct.user_id where u.email = ${email} and ct.reason = 'interview_plan'`;
console.log(rows.length === 1 && rows[0].delta === -5 ? "PASS" : "FAIL", rows);
await sql.end();
EOF
node /tmp/check-plan-charge.mjs "$(cat /tmp/e2e-email.txt)" && rm /tmp/check-plan-charge.mjs
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/interviews/route.ts
git commit -m "$(cat <<'EOF'
Add interview-creation pre-flight credit check and plan charge

Token.LLD.md Section 4. Rejects with 402 before any Claude call if
the estimated cost exceeds balance; charges -5 after the plan and
interview row are created.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Interview turn charge

**Files:**
- Modify: `packages/orchestrator/src/index.ts`

**Interfaces:**
- Consumes: `applyCreditDelta`, `CREDIT_COSTS` (Task 3).

- [ ] **Step 1: Update imports**

Find:

```ts
import {
  MAX_FOLLOW_UPS_PER_TOPIC,
  processTurn,
  type InterviewType,
  type JDAnalysis,
  type PlannedTopic,
  type ResumeAnalysis,
} from "@ai-interviewer/ai-core";
import {
  answers,
  db,
  interviews,
  interviewStates,
  jobDescriptions,
  questions,
  resumes,
} from "@ai-interviewer/db";
import { asc, eq, inArray } from "drizzle-orm";
```

Replace with:

```ts
import {
  MAX_FOLLOW_UPS_PER_TOPIC,
  processTurn,
  type InterviewType,
  type JDAnalysis,
  type PlannedTopic,
  type ResumeAnalysis,
} from "@ai-interviewer/ai-core";
import {
  answers,
  applyCreditDelta,
  CREDIT_COSTS,
  db,
  interviews,
  interviewStates,
  jobDescriptions,
  questions,
  resumes,
} from "@ai-interviewer/db";
import { asc, eq, inArray } from "drizzle-orm";
```

- [ ] **Step 2: Charge once per turn, right after the Claude call succeeds**

Find:

```ts
  const turn = await processTurn({
    resume: resume.parsedJson as ResumeAnalysis,
    jd: (jd?.parsedJson as JDAnalysis | undefined) ?? null,
    currentTopic,
    nextTopic,
    conversationHistory: history,
    currentQuestion: currentQuestion.question,
    candidateAnswer: answerText,
    followUpsSoFarOnTopic: state.followUpsOnCurrentTopic,
    isLastTopic,
    interviewType: interview.type as InterviewType,
    customInstructions: interview.customInstructions,
  });

  let action = turn.action;
```

Replace with:

```ts
  const turn = await processTurn({
    resume: resume.parsedJson as ResumeAnalysis,
    jd: (jd?.parsedJson as JDAnalysis | undefined) ?? null,
    currentTopic,
    nextTopic,
    conversationHistory: history,
    currentQuestion: currentQuestion.question,
    candidateAnswer: answerText,
    followUpsSoFarOnTopic: state.followUpsOnCurrentTopic,
    isLastTopic,
    interviewType: interview.type as InterviewType,
    customInstructions: interview.customInstructions,
  });

  // Charged once per turn regardless of which action Claude picked
  // (follow_up / next_topic / wrap_up all represent one processed answer)
  // — right after the Claude call that's the actual cost driver succeeded,
  // never on a failed call. Token.LLD.md Section 9.
  await applyCreditDelta(userId, -CREDIT_COSTS.interview_turn, "interview_turn", interviewId);

  let action = turn.action;
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/orchestrator && node_modules/.bin/tsc --noEmit
```
Expected: no output.

- [ ] **Step 4: Manual verification**

Resume/reuse the interview created in Task 8 (or create a fresh one — the resume/JD seeding pattern is identical). Submit a turn and confirm the charge:

```bash
INTERVIEW_ID=$(node -e "console.log(require('fs').readFileSync('/tmp/iv.json','utf8').match(/\"id\":\"([^\"]+)\"/)[1])")
curl -s -X POST "http://localhost:3000/api/interviews/$INTERVIEW_ID/turn" -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" \
  -d '{"answer":"I have three years of backend experience with Node.js and Postgres."}' -w "\n%{http_code}\n"

cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/check-turn-charge.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = process.argv[2];
const rows = await sql`select ct.delta, ct.reason from credit_transactions ct join users u on u.id = ct.user_id where u.email = ${email} and ct.reason = 'interview_turn'`;
console.log(rows.length === 1 && rows[0].delta === -5 ? "PASS" : "FAIL", rows);
await sql.end();
EOF
node /tmp/check-turn-charge.mjs "$(cat /tmp/e2e-email.txt)" && rm /tmp/check-turn-charge.mjs
```
Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/src/index.ts
git commit -m "$(cat <<'EOF'
Charge credits per interview turn

Token.LLD.md Section 9 — charged once per processed answer, after
the Claude call succeeds, regardless of the resulting action.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Report generation charge

**Files:**
- Modify: `apps/web/src/app/api/interviews/[id]/report/route.ts`

**Interfaces:**
- Consumes: `applyCreditDelta`, `CREDIT_COSTS` (Task 3).

- [ ] **Step 1: Update imports**

Find:

```ts
import { NextResponse } from "next/server";
import { generateReport, type InterviewType, type JDAnalysis, type ResumeAnalysis } from "@ai-interviewer/ai-core";
import {
  answers,
  db,
  evaluations,
  interviews,
  jobDescriptions,
  questions,
  reports,
  resumes,
} from "@ai-interviewer/db";
import { asc, eq } from "drizzle-orm";
```

Replace with:

```ts
import { NextResponse } from "next/server";
import { generateReport, type InterviewType, type JDAnalysis, type ResumeAnalysis } from "@ai-interviewer/ai-core";
import {
  answers,
  applyCreditDelta,
  CREDIT_COSTS,
  db,
  evaluations,
  interviews,
  jobDescriptions,
  questions,
  reports,
  resumes,
} from "@ai-interviewer/db";
import { asc, eq } from "drizzle-orm";
```

- [ ] **Step 2: Charge only on the path that actually generated a new report**

Find (the final block of the `POST` handler):

```ts
  const [savedReport] = await db
    .update(reports)
    .set({
      status: "ready",
      technicalScore: Math.round(report.overallTechnicalScore),
      communicationScore: Math.round(report.overallCommunicationScore),
      recommendation: report.recommendation,
      studyRoadmap: {
        items: report.studyRoadmap,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        summary: report.summary,
      },
      generatedAt: new Date(),
    })
    .where(eq(reports.interviewId, interviewId))
    .returning();

  return NextResponse.json(savedReport);
}
```

Replace with:

```ts
  const [savedReport] = await db
    .update(reports)
    .set({
      status: "ready",
      technicalScore: Math.round(report.overallTechnicalScore),
      communicationScore: Math.round(report.overallCommunicationScore),
      recommendation: report.recommendation,
      studyRoadmap: {
        items: report.studyRoadmap,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        summary: report.summary,
      },
      generatedAt: new Date(),
    })
    .where(eq(reports.interviewId, interviewId))
    .returning();

  // This code path only runs once per interview — every other return above
  // (already-ready, still-generating, unauthorized, not-found) exits before
  // here, so there's no risk of double-charging a retry or a concurrent poll.
  await applyCreditDelta(interview.userId, -CREDIT_COSTS.report_generation, "report_generation", interviewId);

  return NextResponse.json(savedReport);
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
cd apps/web && npx tsc --noEmit && npx eslint "src/app/api/interviews/[id]/report/route.ts"
```
Expected: no output.

- [ ] **Step 4: Manual verification**

Complete the interview from Task 9 (submit turns until it reports `completed: true`, or cancel it and use a fresh seeded `completed` interview + questions/answers directly via SQL — the latter is faster). Then:

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/seed-completed.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = process.argv[2];
const [user] = await sql`select id from users where email = ${email}`;
const parsedJson = { summary: "Test", skills: ["Node.js"], companies: [], projects: [], achievements: [], technologies: ["Node.js"], claims: [], strongAreas: [], weakAreas: [], suggestedTopics: [] };
const [resume] = await sql`insert into resumes (user_id, url, raw_text, parsed_json) values (${user.id}, 'https://example.com/r.pdf', 'seed', ${sql.json(parsedJson)}) returning id`;
const [iv] = await sql`insert into interviews (user_id, resume_id, type, difficulty, status, duration_minutes, started_at, completed_at) values (${user.id}, ${resume.id}, 'technical', 'medium', 'completed', 20, now() - interval '10 minutes', now()) returning id`;
const [q] = await sql`insert into questions (interview_id, topic, difficulty, question, "order", asked_at) values (${iv.id}, 'Warm-up', 'easy', 'Tell me about yourself.', 0, now()) returning id`;
await sql`insert into answers (question_id, transcript) values (${q.id}, 'I am a backend engineer with three years of experience.')`;
console.log(iv.id);
await sql.end();
EOF
COMPLETED_IV=$(node /tmp/seed-completed.mjs "$(cat /tmp/e2e-email.txt)" | tail -1)
rm /tmp/seed-completed.mjs

curl -s -X POST "http://localhost:3000/api/interviews/$COMPLETED_IV/report" -b /tmp/e2e-cookies.txt -w "\n%{http_code}\n"
# call again — must NOT charge a second time (idempotent "already ready" path)
curl -s -X POST "http://localhost:3000/api/interviews/$COMPLETED_IV/report" -b /tmp/e2e-cookies.txt -w "\n%{http_code}\n"

cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/check-report-charge.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = process.argv[2];
const rows = await sql`select ct.delta from credit_transactions ct join users u on u.id = ct.user_id where u.email = ${email} and ct.reason = 'report_generation'`;
console.log(rows.length === 1 && rows[0].delta === -15 ? "PASS (charged exactly once)" : "FAIL", rows);
await sql.end();
EOF
node /tmp/check-report-charge.mjs "$(cat /tmp/e2e-email.txt)" && rm /tmp/check-report-charge.mjs
```
Expected: `PASS (charged exactly once)` — confirms the second POST hit the idempotent early-return and did not double-charge.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/api/interviews/[id]/report/route.ts"
git commit -m "$(cat <<'EOF'
Charge credits for report generation

Token.LLD.md Section 9 — placed only on the path that actually
generated a new report, so the route's existing idempotency
(already-ready / still-generating early returns) also protects
against double-charging.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Resume/JD/gap analysis charges

**Files:**
- Modify: `apps/web/src/app/api/analyze/route.ts`

**Interfaces:**
- Consumes: `applyCreditDelta`, `CREDIT_COSTS` (Task 3).

- [ ] **Step 1: Rewrite the route**

Replace the full contents of `apps/web/src/app/api/analyze/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { analyzeGap, analyzeJobDescription, analyzeResume, type ResumeAnalysis } from "@ai-interviewer/ai-core";
import { applyCreditDelta, CREDIT_COSTS, db, jobDescriptions, resumes, users } from "@ai-interviewer/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";

const bodySchema = z.object({
  resumeId: z.string().uuid(),
  // Required, not optional — a resume-only analysis has no gap/match score
  // to show and nothing to carry into interview planning, so it isn't a
  // useful standalone step anymore. See the "Launch scope" note this
  // decision came out of.
  jdText: z
    .string()
    .min(50, "Paste the full job description (at least 50 characters)")
    .max(20000, "That's too long for a job description — paste just the posting text"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [resume] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, parsed.data.resumeId), eq(resumes.userId, session.user.id)))
    .limit(1);

  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // Pre-flight affordability check — before any Claude call. Resume
  // analysis only costs anything if it hasn't already run for this resume
  // (see the reuse logic below); JD analysis and gap analysis always run.
  const needsResumeAnalysis = !resume.parsedJson;
  const estimatedCost =
    (needsResumeAnalysis ? CREDIT_COSTS.resume_analysis : 0) + CREDIT_COSTS.jd_analysis + CREDIT_COSTS.gap_analysis;
  const [currentUser] = await db
    .select({ creditBalance: users.creditBalance })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!currentUser || currentUser.creditBalance < estimatedCost) {
    return NextResponse.json(
      { error: "Not enough credits to run this analysis", needed: estimatedCost, balance: currentUser?.creditBalance ?? 0 },
      { status: 402 }
    );
  }

  // Reuse the existing analysis if this resume was already analyzed in an
  // earlier call — avoids re-paying for it when the user just adds a JD.
  const resumeAnalysis =
    (resume.parsedJson as ResumeAnalysis | null) ?? (await analyzeResume(resume.rawText));

  if (!resume.parsedJson) {
    await db.update(resumes).set({ parsedJson: resumeAnalysis }).where(eq(resumes.id, resume.id));
    await applyCreditDelta(session.user.id, -CREDIT_COSTS.resume_analysis, "resume_analysis");
  }

  const jdAnalysis = await analyzeJobDescription(parsed.data.jdText);
  const [jdRow] = await db
    .insert(jobDescriptions)
    .values({
      userId: session.user.id,
      rawText: parsed.data.jdText,
      parsedJson: jdAnalysis,
    })
    .returning();
  await applyCreditDelta(session.user.id, -CREDIT_COSTS.jd_analysis, "jd_analysis");

  const gap = await analyzeGap(resumeAnalysis, jdAnalysis);
  await applyCreditDelta(session.user.id, -CREDIT_COSTS.gap_analysis, "gap_analysis");

  // Persist this as the resume's "last analysis" — previously only ever
  // returned in this response and lost the moment the tab closed, which is
  // exactly the gap (no pun intended) that made /interview/new unable to
  // reliably know which JD/gap to carry into a new session.
  await db
    .update(resumes)
    .set({ lastJdId: jdRow.id, lastGapAnalysisJson: gap })
    .where(eq(resumes.id, resume.id));

  return NextResponse.json({
    resume: { id: resume.id, parsed: resumeAnalysis },
    jd: { id: jdRow.id, parsed: jdAnalysis },
    gap,
  });
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
cd apps/web && npx tsc --noEmit && npx eslint src/app/api/analyze/route.ts
```
Expected: no output.

- [ ] **Step 3: Manual verification — full charge on first call, partial on reuse**

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/seed-fresh-resume.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = process.argv[2];
const [user] = await sql`select id from users where email = ${email}`;
const [resume] = await sql`insert into resumes (user_id, url, raw_text) values (${user.id}, 'https://example.com/r2.pdf', 'A backend engineer resume with real content for analysis testing purposes and enough length to pass extraction.') returning id`;
console.log(resume.id);
await sql.end();
EOF
FRESH_RESUME=$(node /tmp/seed-fresh-resume.mjs "$(cat /tmp/e2e-email.txt)" | tail -1)
rm /tmp/seed-fresh-resume.mjs

curl -s -X POST http://localhost:3000/api/analyze -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" \
  -d "{\"resumeId\":\"$FRESH_RESUME\",\"jdText\":\"We are hiring a backend engineer with strong Node.js and PostgreSQL experience to join our platform team and own critical services.\"}" -w "\n%{http_code}\n"

curl -s -X POST http://localhost:3000/api/analyze -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" \
  -d "{\"resumeId\":\"$FRESH_RESUME\",\"jdText\":\"A second, different job description text for the same resume, testing that resume analysis is not re-charged the second time around.\"}" -w "\n%{http_code}\n"

cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/check-analyze-charges.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const email = process.argv[2];
const rows = await sql`select ct.reason, count(*) as n from credit_transactions ct join users u on u.id = ct.user_id where u.email = ${email} and ct.reason in ('resume_analysis','jd_analysis','gap_analysis') group by ct.reason order by ct.reason`;
console.log(rows);
const resumeCount = rows.find(r => r.reason === 'resume_analysis')?.n ?? 0;
const jdCount = rows.find(r => r.reason === 'jd_analysis')?.n ?? 0;
const gapCount = rows.find(r => r.reason === 'gap_analysis')?.n ?? 0;
console.log(Number(resumeCount) === 1 && Number(jdCount) === 2 && Number(gapCount) === 2 ? "PASS" : "FAIL");
await sql.end();
EOF
node /tmp/check-analyze-charges.mjs "$(cat /tmp/e2e-email.txt)" && rm /tmp/check-analyze-charges.mjs
```
Expected: `PASS` — resume charged once (first call only, since the second call reuses `resume.parsedJson`), JD and gap charged on both calls.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/analyze/route.ts
git commit -m "$(cat <<'EOF'
Charge credits for resume/JD/gap analysis

Token.LLD.md Section 9. Resume analysis is charged only when it
actually runs (first analysis of a given resume); JD and gap
analysis are charged every call. Pre-flight check before any Claude
call in this route.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Profile page — password change

**Files:**
- Create: `apps/web/src/app/api/profile/password/route.ts`
- Create: `apps/web/src/app/profile/change-password-form.tsx`
- Create: `apps/web/src/app/profile/page.tsx` (shell only — Task 13 adds the credits section to this same file)

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` (`apps/web/src/lib/password.ts`, unchanged).
- Produces: `POST /api/profile/password`, the `/profile` route (shell), consumed/extended by Task 13.

- [ ] **Step 1: Write the password-change route**

```ts
// apps/web/src/app/api/profile/password/route.ts
import { NextResponse } from "next/server";
import { db, users } from "@ai-interviewer/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "This account can't change its password here" }, { status: 400 });
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the client form**

```tsx
// apps/web/src/app/profile/change-password-form.tsx
"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to change password");
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="studio-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-primary" />
          Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={submitting} className="mt-1 gap-2 self-start">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Write the page shell**

```tsx
// apps/web/src/app/profile/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";

import { ChangePasswordForm } from "./change-password-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <ChangePasswordForm />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

```bash
cd apps/web && npx tsc --noEmit && npx eslint src/app/api/profile/password/route.ts src/app/profile/change-password-form.tsx src/app/profile/page.tsx
```
Expected: no output.

- [ ] **Step 5: Manual verification**

```bash
curl -s -X POST http://localhost:3000/api/profile/password -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" \
  -d '{"currentPassword":"WrongPassword!","newPassword":"NewPassword123!"}' -w "\n%{http_code}\n"
curl -s -X POST http://localhost:3000/api/profile/password -b /tmp/e2e-cookies.txt -H "Content-Type: application/json" \
  -d '{"currentPassword":"TestPass123!","newPassword":"NewPassword123!"}' -w "\n%{http_code}\n"

# confirm the new password actually works
CSRF=$(curl -s http://localhost:3000/api/auth/csrf -c /tmp/e2e-cookies2.txt | grep -oE '"csrfToken":"[^"]+"' | cut -d'"' -f4)
curl -s -X POST http://localhost:3000/api/auth/callback/password -b /tmp/e2e-cookies2.txt -c /tmp/e2e-cookies2.txt \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=$(cat /tmp/e2e-email.txt)" --data-urlencode "password=NewPassword123!" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "json=true" -w "\n%{http_code}\n"
rm /tmp/e2e-cookies2.txt
```
Expected: first call 400 "Current password is incorrect"; second call 200; third call (sign-in with the new password in a fresh cookie jar) 302 (success redirect).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/profile/password/ apps/web/src/app/profile/
git commit -m "$(cat <<'EOF'
Add profile page with password change

Token.LLD.md Section 7 (password half). Credits section added in
the next task, same page.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Profile page — credits section (top-notch UI)

This is the task the "credits UI must be top-notch" requirement lands on. Build a solid first pass following the design system exactly (below), then run an explicit `/impeccable polish` pass over the finished page before calling it done — that's where live iteration and the design detector catch anything the static code below doesn't.

**Files:**
- Create: `apps/web/src/app/profile/redeem-code-form.tsx`
- Create: `apps/web/src/app/profile/credit-history.tsx`
- Modify: `apps/web/src/app/profile/page.tsx`

**Interfaces:**
- Consumes: `POST /api/credits/redeem` (Task 5), `users.creditBalance`, `creditTransactions` (Task 1).

- [ ] **Step 1: Write the redeem form**

```tsx
// apps/web/src/app/profile/redeem-code-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RedeemCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to redeem code");
      toast.success(`+${data.credited} credits added`);
      setCode("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to redeem code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <Label htmlFor="redeemCode">Redeem a code</Label>
      <div className="flex gap-2">
        <Input
          id="redeemCode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. BETA50"
          className="font-mono uppercase"
          required
        />
        <Button type="submit" disabled={submitting} className="shrink-0 gap-1.5">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
          Redeem
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Write the transaction history**

```tsx
// apps/web/src/app/profile/credit-history.tsx
import { History } from "lucide-react";

type Transaction = {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: Date;
};

const REASON_LABELS: Record<string, string> = {
  resume_analysis: "Resume analysis",
  jd_analysis: "Job description analysis",
  gap_analysis: "Gap analysis",
  interview_plan: "Interview started",
  interview_turn: "Interview question",
  report_generation: "Report generated",
  signup_grant: "Welcome bonus",
  redeem_code: "Code redeemed",
  admin_grant: "Manual adjustment",
};

function formatRelativeTime(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export function CreditHistory({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
        <History className="size-3.5" />
        Recent activity
      </span>
      {transactions.length > 0 ? (
        <div className="studio-panel flex flex-col divide-y divide-border rounded-md">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span>{REASON_LABELS[t.reason] ?? t.reason}</span>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`font-mono text-xs ${t.delta >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {t.delta >= 0 ? `+${t.delta}` : t.delta}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{formatRelativeTime(t.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="studio-panel flex flex-col items-center gap-1.5 rounded-md py-8 text-center">
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update the page — balance tile + redeem form + history**

Replace the full contents of `apps/web/src/app/profile/page.tsx` with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { creditTransactions, db, users } from "@ai-interviewer/db";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Coins } from "lucide-react";

import { auth } from "@/lib/auth";

import { ChangePasswordForm } from "./change-password-form";
import { CreditHistory } from "./credit-history";
import { RedeemCodeForm } from "./redeem-code-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const [[user], transactions] = await Promise.all([
    db.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, session.user.id)).limit(1),
    db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, session.user.id))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(20),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <div className="flex flex-col gap-4">
        <div className="studio-panel studio-glow flex flex-col items-center gap-1 rounded-md py-6 text-center">
          <span className="flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
            <Coins className="size-3.5 text-primary" />
            Credit balance
          </span>
          <span className="font-mono text-4xl font-semibold tabular-nums">{user?.creditBalance ?? 0}</span>
        </div>

        <RedeemCodeForm />
        <CreditHistory transactions={transactions} />
      </div>

      <ChangePasswordForm />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

```bash
cd apps/web && npx tsc --noEmit && npx eslint src/app/profile/page.tsx src/app/profile/redeem-code-form.tsx src/app/profile/credit-history.tsx
```
Expected: no output.

- [ ] **Step 5: Design detector**

```bash
cd /Users/rohittyagi/Desktop/repos/ai-interviewer-app && node /Users/rohittyagi/.claude/skills/impeccable/scripts/detect.mjs --json apps/web/src/app/profile/page.tsx apps/web/src/app/profile/redeem-code-form.tsx apps/web/src/app/profile/credit-history.tsx apps/web/src/app/profile/change-password-form.tsx
```
Expected: `[]`. Fix any findings (or justify a false positive with reasoning, matching this project's established practice) before proceeding.

- [ ] **Step 6: Design polish pass**

Run `/impeccable polish apps/web/src/app/profile` in a live session against a running `next dev` server with a signed-in test user that has a non-empty transaction history (reuse the test user from earlier tasks — it already has resume/JD/gap/plan/turn/report/redeem transactions from Tasks 4-11's verification). This is where the "top-notch" bar actually gets enforced: motion on the balance reveal, spacing rhythm between the three sections, empty-state quality for a brand-new user with a $0 history, and a final visual pass in the browser — not something fully specifiable as static code above. Apply whatever the polish pass surfaces, re-run Steps 4-5 after.

- [ ] **Step 7: Manual verification**

```bash
curl -s http://localhost:3000/profile -b /tmp/e2e-cookies.txt -o /tmp/profile.html -w "%{http_code}\n"
grep -o 'Credit balance\|Redeem a code\|Recent activity\|Welcome bonus\|Interview started\|Code redeemed' /tmp/profile.html | sort -u
grep -oE '<span class="font-mono text-4xl font-semibold tabular-nums">[0-9]+</span>' /tmp/profile.html
rm /tmp/profile.html
```
Expected: 200, all six labels present (confirming balance tile, redeem form, and a history populated by every reason exercised across Tasks 4-11), and the balance span shows the current numeric total.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "$(cat <<'EOF'
Add credits section to the profile page

Balance tile, redeem-code form, and transaction history — the
"top-notch" credits UI, built on the existing studio-panel/mono-
label design system and passed through an impeccable polish pass.
Token.LLD.md Section 7.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Dashboard nav — Profile link, balance chip, Admin link

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `users.creditBalance` (Task 1), `session.user.role` (Task 2).

- [ ] **Step 1: Add the balance/profile/admin header pieces**

Find (the query block and the header):

```ts
  const [statusCounts, typeCounts, avgScores, recentInterviews] = await Promise.all([
    db.select({ status: interviews.status, count: count() }).from(interviews).where(eq(interviews.userId, userId)).groupBy(interviews.status),
```

Replace with (adding a fifth parallel query for the balance):

```ts
  const [statusCounts, typeCounts, avgScores, recentInterviews, [currentUser]] = await Promise.all([
    db.select({ status: interviews.status, count: count() }).from(interviews).where(eq(interviews.userId, userId)).groupBy(interviews.status),
```

Find the closing of that `Promise.all` array and add the new query as its last element — locate:

```ts
      .orderBy(desc(interviews.createdAt))
      .limit(12),
  ]);
```

Replace with:

```ts
      .orderBy(desc(interviews.createdAt))
      .limit(12),
    db.select({ creditBalance: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
```

(This file currently imports `{ db, interviews, reports }` from `@ai-interviewer/db` and nothing named `users`, so the plain name is safe — no collision.)

- [ ] **Step 2: Update the import line**

Find:

```ts
import { db, interviews, reports } from "@ai-interviewer/db";
```

Replace with:

```ts
import { db, interviews, reports, users } from "@ai-interviewer/db";
```

- [ ] **Step 3: Update the header JSX**

Find:

```tsx
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Link href="/" className="font-serif text-lg text-muted-foreground hover:text-foreground">
          interview<span className="accent-text font-semibold">.ai</span>
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button variant="outline" size="sm" type="submit" className="gap-1.5">
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </form>
      </div>
```

Replace with:

```tsx
      <div className="flex items-center justify-between border-b border-border pb-5">
        <Link href="/" className="font-serif text-lg text-muted-foreground hover:text-foreground">
          interview<span className="accent-text font-semibold">.ai</span>
        </Link>
        <div className="flex items-center gap-2">
          {session.user.role === "admin" && (
            <Link href="/admin/codes" className="text-xs text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          )}
          <Link
            href="/profile"
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Coins className="size-3 text-primary" />
            {currentUser?.creditBalance ?? 0}
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button variant="outline" size="sm" type="submit" className="gap-1.5">
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </form>
        </div>
      </div>
```

- [ ] **Step 4: Add the `Coins` icon import**

Find:

```ts
import { LogOut } from "lucide-react";
```

Replace with:

```ts
import { Coins, LogOut } from "lucide-react";
```

- [ ] **Step 5: Typecheck + lint**

```bash
cd apps/web && npx tsc --noEmit && npx eslint src/app/dashboard/page.tsx
```
Expected: no output.

- [ ] **Step 6: Design detector**

```bash
cd /Users/rohittyagi/Desktop/repos/ai-interviewer-app && node /Users/rohittyagi/.claude/skills/impeccable/scripts/detect.mjs --json apps/web/src/app/dashboard/page.tsx
```
Expected: `[]`.

- [ ] **Step 7: Manual verification**

```bash
curl -s http://localhost:3000/dashboard -b /tmp/e2e-cookies.txt -o /tmp/dash.html -w "%{http_code}\n"
grep -o 'href="/profile"\|href="/admin/codes"' /tmp/dash.html
rm /tmp/dash.html
```
Expected: `href="/profile"` present; `href="/admin/codes"` present too, since the test user was promoted to admin in Task 6.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
Add balance chip and Profile/Admin links to the dashboard header

Makes the credit balance visible at a glance from the page users
land on most, not just buried in /profile.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Full end-to-end verification and cleanup

**Files:** none (verification only).

- [ ] **Step 1: Run the complete flow against a brand-new user**

```bash
lsof -t -i:3000 | xargs -r kill -9; cd apps/web && (nohup npx next dev > /tmp/next-dev.log 2>&1 &); sleep 6

EMAIL="e2e-full-$(date +%s)@example.com"; echo $EMAIL > /tmp/e2e-full-email.txt
curl -s -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"Full Flow Tester\"}"
sleep 1
CODE=$(grep "\[dev\] OTP for $EMAIL" /tmp/next-dev.log | tail -1 | grep -oE '[0-9]{6}$')
curl -s -X POST http://localhost:3000/api/auth/verify-email -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}"
CSRF=$(curl -s http://localhost:3000/api/auth/csrf -c /tmp/e2e-full-cookies.txt | grep -oE '"csrfToken":"[^"]+"' | cut -d'"' -f4)
curl -s -X POST http://localhost:3000/api/auth/callback/password -b /tmp/e2e-full-cookies.txt -c /tmp/e2e-full-cookies.txt \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "email=$EMAIL" --data-urlencode "password=TestPass123!" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "json=true"

# confirm 220-credit grant
curl -s http://localhost:3000/dashboard -b /tmp/e2e-full-cookies.txt | grep -o '220'
```
Expected: `220` found in the dashboard's balance chip.

Continue the flow: upload+analyze a resume/JD (via `/api/resumes` then `/api/analyze` — use the same seeded-content pattern as earlier tasks, or drive it through actual file upload if a sample PDF is available in the repo's test fixtures), create an interview, submit a couple of turns, complete it, generate the report, redeem a code, and check balance decreased by the expected total at each step. This should feel identical to Tasks 4-11's individual verifications, just chained on one fresh account instead of split across tasks — if each of those passed individually, this step is mainly confirming nothing about the interactions between them broke (e.g., a double-import collision, a stale balance read).

- [ ] **Step 2: Confirm the low-balance pre-flight block one more time, end-to-end through the UI's own error surface**

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/drain-balance.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
await sql`update users set credit_balance = 1 where email = ${process.argv[2]}`;
console.log("drained");
await sql.end();
EOF
node /tmp/drain-balance.mjs "$(cat /tmp/e2e-full-email.txt)" && rm /tmp/drain-balance.mjs
```

Then attempt to create another interview via the API as in Task 8 — expect `402` with a clear `needed`/`balance` payload.

- [ ] **Step 3: Clean up all test data**

```bash
cd packages/db && set -a && source ../../apps/web/.env.local && set +a && cat > /tmp/final-cleanup.mjs <<'EOF'
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const rows = await sql`delete from users where email like 'e2e-%@example.com' returning email`;
console.log("cleaned up", rows.length, "test users");
const codes = await sql`delete from redeem_codes where code in ('TESTCODE1') returning code`;
console.log("cleaned up codes:", codes.map(c => c.code));
await sql.end();
EOF
node /tmp/final-cleanup.mjs && rm /tmp/final-cleanup.mjs
rm -f /tmp/e2e-cookies.txt /tmp/e2e-email.txt /tmp/e2e-full-cookies.txt /tmp/e2e-full-email.txt /tmp/iv.json /tmp/admin-codes.html /tmp/next-dev.log
```

- [ ] **Step 4: Stop the dev server**

```bash
lsof -t -i:3000 | xargs -r kill -9
```

- [ ] **Step 5: Full workspace typecheck (catches any cross-package drift the per-task checks missed)**

```bash
cd apps/web && npx tsc --noEmit && cd ../../packages/db && node_modules/.bin/tsc --noEmit && cd ../ai-core && node_modules/.bin/tsc --noEmit && cd ../orchestrator && node_modules/.bin/tsc --noEmit
```
Expected: no output from any of the four.

No commit for this task — it's verification only, nothing changes in the working tree.

---

## Self-Review Notes

- **Spec coverage:** every section of `Token.LLD.md` maps to a task — Section 3 (schema) → Task 1; Section 3's write path → Task 3; Section 4 (costs/pre-flight) → Tasks 3, 8, 11; Section 5 (redeem) → Task 5; Section 6 (admin) → Task 6; Section 7 (profile) → Tasks 12-13; Section 8 (out of scope) → deliberately no task; Section 9 (enforcement checklist) → Tasks 8-11. Section 10's open questions were resolved during this planning pass: turn-charge placement is in the orchestrator (Task 9, confirmed — it already owns `userId` and is transport-agnostic per its own header comment), and the signup-grant timing is at first email verification, not row creation (Task 4).
- **A real gap found during planning, not assumed:** `Token.LLD.md` Section 9 guessed at `resumes/route.ts` and `job-descriptions/route.ts` as separate charge sites. Reading the actual current code (`apps/web/src/app/api/resumes/route.ts` only uploads/extracts text — no Claude call at all; JD analysis and gap analysis both live inside the single `/api/analyze/route.ts`, and `apps/web/src/app/api/job-descriptions/route.ts` doesn't exist) changed Task 11 into a single-route task with conditional resume charging, rather than the two-route design the LLD guessed at.
- **A second gap found during planning:** the session never carried `role`, despite the LLD assuming role-gating "just works" from the existing enum. Added Task 2 specifically to close this before Task 6 (admin page) depends on it.
- **Nested-transaction risk caught before it shipped:** an early draft of Task 5 wrapped `applyCreditDelta` inside the same `db.transaction` as the redeem-code validation, which would have opened a second top-level transaction on a separate connection while the first was still open — a lock-wait-against-itself bug. Fixed by keeping `applyCreditDelta` as a separate, sequential call, with the tradeoff documented in the route's own comment.
