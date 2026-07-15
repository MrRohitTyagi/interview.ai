# Credits System – Low Level Design (LLD)

> Version: 1.0 (testing-phase POC)
>
> Companion to `LLD.md` — covers usage metering, the redeem-code flow, and the
> user profile page. Payment is explicitly out of scope; see Section 8.

---

# 1. Motivation

`LLD.md` Section 16B already flags the problem this solves: Claude (Sonnet
per-turn calls, Opus report generation), and optionally ElevenLabs TTS, are
the only genuinely usage-based pieces of the stack, and their cost needs to
be "modeled ... so pricing/rate-limits can be set deliberately rather than
discovered after the first bill." A credits system is that mechanism: every
user gets a finite balance, every AI action spends from it, and — for now,
during testing — the only way to top up is a redeem code the developer
generates by hand. Payment is deferred to a later phase (Section 8).

---

# 2. What actually costs money today

Enumerated directly from `packages/ai-core/src`. STT is the browser's
Web Speech API (client-side, zero server cost) and is not metered.

| Action | Call site | Model | Frequency |
|---|---|---|---|
| Resume analysis | `resume.ts` | Haiku 4.5 | once per resume upload |
| JD analysis | `job-description.ts` | Haiku 4.5 | once per JD upload |
| Gap analysis | `gap-analysis.ts` | Sonnet 5 | once per `/api/analyze` call |
| Interview plan | `interview-planner.ts` | Sonnet 5 | once per interview created |
| Interview turn | `interview-agent.ts` | Sonnet 5 | **once per candidate answer** — dominant recurring cost |
| Report generation | `report-generator.ts` | Opus 4.8 (priciest tier) | once per interview completed |
| TTS (optional) | `/api/tts` | ElevenLabs, char-based | already has an automatic browser-TTS fallback; not metered in v1 |

---

# 3. Data model

Two new tables in `packages/db/src/schema.ts`, plus one new column on
`users`.

```
users
  + creditBalance   integer not null default 0

credit_transactions
  id            uuid pk, default random
  userId        uuid → users.id, cascade delete
  delta         integer            -- negative = charge, positive = grant
  reason        text, enum:
                  "resume_analysis" | "jd_analysis" | "gap_analysis"
                  | "interview_plan" | "interview_turn"
                  | "report_generation" | "signup_grant"
                  | "redeem_code" | "admin_grant"
  interviewId   uuid, nullable → interviews.id
  balanceAfter  integer            -- snapshot; history reads never recompute
  createdAt     timestamp, default now

redeem_codes
  id            uuid pk, default random
  code          text, unique       -- e.g. "BETA50"
  credits       integer
  maxUses       integer
  usedCount     integer, default 0
  createdBy     uuid → users.id
  createdAt     timestamp, default now

redeem_code_uses
  id            uuid pk, default random
  codeId        uuid → redeem_codes.id, cascade delete
  userId        uuid → users.id, cascade delete
  createdAt     timestamp, default now
  unique(codeId, userId)            -- one redemption per user per code
```

`"admin_grant"` in the `reason` enum isn't wired to any UI in this design —
it exists so a direct `applyCreditDelta` call (run by hand, e.g. to
compensate a user after a bug) still lands in the ledger with a legible
reason instead of an untagged manual balance edit. No admin "grant credits
to a user" screen is being built now; the redeem-code flow (Section 5) is
the only credit-granting UI in this design.

### Why a cached balance *and* a ledger

`users.creditBalance` is the fast, indexed read used on every hot-path check
(every interview turn touches this). `credit_transactions` is the durable,
append-only history — what makes a balance change legible on the profile
page instead of a mystery, and what a support/debug session would actually
read. A pure-ledger design (balance = `SUM(delta)` on every read) was
considered and rejected: it turns the single hottest read in the system
(the per-turn balance check) into an aggregate query for no real benefit at
this app's scale, and the atomic check-and-deduct is harder to do safely
under concurrency.

### The one write path

Every credit change — charge or grant — goes through a single function:

```ts
applyCreditDelta(userId, delta, reason, interviewId?)
```

It runs inside one DB transaction and performs the balance update as a
single atomic statement:

```sql
UPDATE users
SET credit_balance = credit_balance + $delta
WHERE id = $userId AND credit_balance + $delta >= 0
RETURNING credit_balance
```

If the `WHERE` clause matches zero rows (would-go-negative), the function
throws `InsufficientCreditsError` and nothing is written — this is what
makes concurrent requests (e.g. two browser tabs) unable to race each other
into a negative balance, and is the only place negative-balance protection
lives. The ledger row is inserted in the same transaction, so balance and
history can never drift apart.

---

# 4. Credit costs & pre-flight estimation

Costs are weighted roughly by real model cost (Opus > Sonnet > Haiku) and
call frequency:

| Action | Cost (credits) |
|---|---|
| Resume analysis | 2 |
| JD analysis | 2 |
| Gap analysis | 3 |
| Interview plan (on start) | 5 |
| Each interview turn | 5 |
| Report generation | 15 |

### Pre-flight check on interview creation

Before `POST /api/interviews` calls `generateInterviewPlan`, it computes an
**expected-case** cost estimate for the interview about to be created —
deliberately not the absolute worst case (every topic maxing out its follow-
up cap), since that would routinely block users who'd actually have been
fine and undercuts the "don't strand the user" intent below. Instead it
assumes a realistic average of 1 follow-up per topic (2 turns/topic: one
opening question, one follow-up):

```
estimate = planCost + topicCount × 2 × turnCost + reportCost
```

(`topicCount` from `interview-planner.ts`'s existing
`topicCountForDuration`.) If `creditBalance < estimate`, the request is
rejected with `402`-style JSON (`{ error: "not enough credits", needed,
balance }`) **before any Claude call is made** — no spend on a request that
was going to be rejected anyway. The web app surfaces this as a clear
message on the "Start interview" flow with a direct link to the profile's
redeem box.

**Worked example:** the system's default interview duration is 30 minutes
(`apps/web/src/app/api/interviews/route.ts`'s `durationMinutes` default),
which `topicCountForDuration` maps to 8 topics. Estimate = 5 (plan) +
8 × 2 × 5 (turns) + 15 (report) = **100 credits**. New signups are granted
**220 credits** (`reason: "signup_grant"`) — two such interviews (200) plus
headroom for a resume/JD upload (4) and one occasional follow-up-heavy
session, while still finite enough that the redeem flow actually gets
exercised during testing.

### Mid-interview behavior

Once an interview has started, it is allowed to run to completion even if
per-turn charges push the balance to zero or slightly negative — because
the pre-flight number above is an *expected* cost, not a hard ceiling, a
topic or two running to the full follow-up cap can genuinely push a real
session past the estimate. This is a deliberate choice, not an oversight: a
live spoken interview is this product's core experience, and PRODUCT.md's
own principle — "never strand the user in a hidden failure state" — rules
out a mid-conversation cutoff. When an overrun does happen, the interview
still finishes and the balance simply reads negative until the user redeems
a code. New interview creation is blocked whenever `creditBalance <= 0`,
regardless of the estimate.

---

# 5. Redeem-code flow

One box on the profile page (Section 7): the user pastes a code and submits
to `POST /api/credits/redeem { code }`. Server-side, in one transaction:

1. Look up the code; 404 if it doesn't exist.
2. Reject if `usedCount >= maxUses`.
3. Reject if a `redeem_code_uses` row already exists for `(codeId, userId)`
   — the unique constraint makes this safe under concurrent double-submits,
   not just a pre-check.
4. `applyCreditDelta(userId, +code.credits, "redeem_code")`.
5. Insert the `redeem_code_uses` row, increment `redeem_codes.usedCount`.

This single mechanism covers both things originally described as separate
("gift redeem" and "referral code") — one redeem-a-code system, codes
generated by hand for now (Section 6).

---

# 6. Admin code-generation page

Route: `/admin/codes`, gated by `session.user.role === "admin"` — the
`user_role` enum already includes `"admin"` (`packages/db/src/schema.ts`),
so this needs no new permissions system, just a server-side role check in
the route/page.

- A form: code string (optional — auto-generate if left blank, e.g.
  `nanoid(8)` uppercased), credit amount, max uses. Submits to
  `POST /api/admin/codes`.
- A table below listing existing codes with `usedCount / maxUses` and
  created date.
- No edit/delete in v1 — YAGNI. A code can be effectively deactivated by
  setting `maxUses = usedCount` later if that's ever needed; not building
  that path until it's actually needed.

---

# 7. Profile page

New route `/profile`, linked from the dashboard header (next to the
existing sign-out button). Two sections:

**Password change** — current password, new password, confirm new
password. Reuses the existing `verifyPassword` / hashing helpers already in
`apps/web/src/lib/password.ts`; no new crypto code. Standard validation
(current password must verify; new password meets the same rules already
enforced at signup).

**Credits** —
- Current balance, shown prominently (large mono number, consistent with
  the "On Air" design system's existing score/stat treatment).
- Redeem-code input + submit (Section 5).
- A short recent-transactions list — reason, delta, resulting balance,
  relative date — read directly from `credit_transactions`, newest first,
  capped (e.g. last 20). This is what makes "why did my balance drop"
  answerable from the UI itself rather than a support question.

Nothing else. No payment link, no referral-link generation, no avatar/name
editing — none of that was asked for, and payment is explicitly deferred
(Section 8).

---

# 8. Explicitly out of scope (Phase 2)

- Real payment integration (Stripe or equivalent) to purchase credits.
- Any pricing page or checkout flow.
- Self-serve, per-user shareable referral links with two-sided rewards —
  what exists now is a single admin-generated code redeemed by anyone, not
  a referral program. If a true referral program is wanted later, it's a
  distinct feature (unique per-user codes, reward-both-sides logic,
  fraud/abuse considerations) and should get its own spec rather than being
  folded into this one.

---

# 9. Enforcement points (implementation checklist)

Each existing AI call site gets wrapped with an `applyCreditDelta` call
immediately after a successful Claude response (never on a failed call —
no charging for something that didn't happen):

- `apps/web/src/app/api/resumes/route.ts` → after resume analysis: -2
- `apps/web/src/app/api/job-descriptions/route.ts` → after JD analysis: -2
- `apps/web/src/app/api/analyze/route.ts` (calls `analyzeGap`) → after gap
  analysis: -3
- `apps/web/src/app/api/interviews/route.ts` → pre-flight estimate check,
  then after plan generation: -5
- `packages/orchestrator/src/index.ts` (`processInterviewTurn`) → after
  each successful turn: -5
- `apps/web/src/app/api/interviews/[id]/report/route.ts` → after report
  generation completes: -15
- Signup route (wherever the `users` row is first inserted — email/otp
  verification, per the existing signup flow) → grant +220
  (`signup_grant`)

---

# 10. Open questions for the implementation plan

- Whether `packages/orchestrator` (which already owns `processInterviewTurn`
  and has DB access) is the right place for the turn-charge call, or
  whether it belongs one layer up in the HTTP route — orchestrator seems
  right since it's already transport-agnostic per its own header comment,
  but worth confirming during planning.
- Exactly which step of the signup flow (initial `users` insert vs. the
  point where `emailVerified` gets set) should trigger the grant — granting
  at row-creation is simpler, but means an unverified signup already holds
  a balance. Worth a deliberate call during planning rather than assuming.
