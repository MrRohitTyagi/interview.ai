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

New signups are granted **150 credits** (`reason: "signup_grant"`) —
comfortably two full ~30-minute interviews at typical topic counts (see
estimation formula below), while still being finite enough that the credit
system itself gets exercised during testing.

### Pre-flight check on interview creation

Before `POST /api/interviews` calls `generateInterviewPlan`, it computes a
worst-case cost estimate for the interview about to be created:

```
estimate = planCost
         + topicCount × (1 + MAX_FOLLOW_UPS_PER_TOPIC) × turnCost
         + reportCost
```

(`topicCount` from `interview-planner.ts`'s existing
`topicCountForDuration`; `MAX_FOLLOW_UPS_PER_TOPIC` already exported from
`interview-agent.ts` as `2`.) If `creditBalance < estimate`, the request is
rejected with `402`-style JSON (`{ error: "not enough credits", needed,
balance }`) **before any Claude call is made** — no spend on a request that
was going to be rejected anyway. The web app surfaces this as a clear
message on the "Start interview" flow with a direct link to the profile's
redeem box.

### Mid-interview behavior

Once an interview has started, it is allowed to run to completion even if
per-turn charges push the balance to zero or slightly negative. This is a
deliberate choice, not an oversight: a live spoken interview is this
product's core experience, and PRODUCT.md's own principle — "never strand
the user in a hidden failure state" — rules out a mid-conversation cutoff.
The pre-flight estimate (worst case: every topic hits the max follow-up
cap) makes an overrun rare in practice; when it does happen, the interview
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
- `apps/web/src/app/api/analyze/route.ts` (or wherever gap analysis lives)
  → after gap analysis: -3
- `apps/web/src/app/api/interviews/route.ts` → pre-flight estimate check,
  then after plan generation: -5
- `packages/orchestrator/src/index.ts` (`processInterviewTurn`) → after
  each successful turn: -5
- Report generation call site → after report ready: -15
- Signup route → grant +150 (`signup_grant`)

---

# 10. Open questions for the implementation plan

- Exact route for gap analysis charging (name/location to confirm against
  current `apps/web/src/app/api` layout at implementation time).
- Whether `packages/orchestrator` (which already owns `processInterviewTurn`
  and has DB access) is the right place for the turn-charge call, or
  whether it belongs one layer up in the HTTP route — orchestrator seems
  right since it's already transport-agnostic per its own header comment,
  but worth confirming during planning.
