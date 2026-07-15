# Coding Round – Low Level Design (LLD)

> Status: Research / proposal — not yet built. Targets Phase 5 ("company personas, coding round, system design round, cross-session memory") per LLD.md Section 19.
>
> This is a standalone design doc, not a diff. It assumes the reader has already read `LLD.md` (conventions, cost posture, existing schema/agent architecture) and `packages/db/src/schema.ts` (actual current tables).

## Launch scope — decided

**V1 ships JS-only.** A pure problem-solving round — algorithmic questions (arrays, strings, recursion, etc.), JavaScript only, executed entirely client-side. This resolves Open Question #1 below in favor of the zero-infrastructure path:

- **No Piston, no self-hosted execution engine, no VM, no Oracle Cloud, no ops surface.** Section 3.4's in-browser QuickJS-WASM approach is the *entire* v1 execution story, not one branch of a hybrid.
- **No Java/C++/Python support at launch.** Sections 3.1–3.3 (Piston/Judge0) and the Python half of 3.4 (Pyodide) are kept in this doc as the documented *next* step once the JS-only round is validated, not as v1 scope.
- **No React/component questions at launch either.** Rendering and testing a UI component needs a real DOM (a sandboxed iframe, not QuickJS) and a different test-case shape (DOM-interaction scripts, not input/output pairs) — see the new Section 10. It's a genuine second problem *kind*, not a follow-on to plain JS, and is explicitly future scope.
- Every section below is written for the general hybrid design (useful once the JS-only round is proven out and Java/C++ support is worth the infra cost), but is now annotated with **[V1]** / **[Future]** markers so it's unambiguous what actually gets built first.

---

# 1. Overview / Goal

Add a **coding round** as a second, independent tab on an existing interview: `Interview` (the current voice tab) | `Coding` | `Report`. The candidate opens the Coding tab, is given one or more **JavaScript** problem-solving questions, writes code in an in-browser editor, runs it against sample tests, submits it, and gets a score that folds into the same report the voice round produces.

Explicit non-goals (per the user's framing and LLD's cost/scope discipline):

- **JS only at launch.** [V1] No Python/Java/C++, no language picker in the UI — the editor opens straight into a JavaScript problem. Multi-language is real future scope (Section 3), not dropped, just not v1.
- **Algorithmic problems only, not components.** [V1] "Build a debounced search box" or any React/DOM question is out of scope for launch — see Section 10 for why that's a different feature, not a harder version of this one.
- **Not merged into the voice flow.** `voice-chat.tsx` and `processInterviewTurn` are untouched. The coding round is a parallel, independently-gradable artifact attached to the same `interviewId`.
- **Not a real-time pair-programming experience.** No live typing broadcast, no AI watching keystrokes. The model sees code only at "Run" and "Submit," same as the voice round only evaluates after an answer is submitted.
- **Not LeetCode.** No claim of a large curated problem catalog at launch — see Section 4 for what's actually achievable for free.

The two hard technical problems this doc has to answer honestly are: (a) how do you run arbitrary candidate-submitted code safely without paying for it, and (b) where do problems + correct test cases come from without infringing anyone's IP. Section 3 and Section 4 are the load-bearing sections — and for the JS-only v1, (a) has a clean, complete answer: nothing runs on a server at all.

---

# 2. Editor Choice

## Candidates

| | Monaco Editor | CodeMirror 6 |
|---|---|---|
| What it is | VS Code's editor, extracted as a standalone web component | Modular, from-scratch rewrite of CodeMirror |
| License | MIT | MIT |
| Bundle size | ~2–5MB gzipped for the full editor + language services | ~50KB tree-shaken core; each language grammar is a separate small package |
| Language support | 60+ languages built in, incl. full TS/JS language service (real IntelliSense, not just highlighting), Python, Java, C++ syntax highlighting out of the box | Highlighting via Lezer grammars — Python, Java, C++, JS/TS all have maintained `@codemirror/lang-*` packages, but no built-in language *service* (no real autocomplete/type-checking without extra work) |
| React wrapper | `@monaco-editor/react` — actively maintained, ~380k weekly downloads, handles worker/CDN setup for you | No single official wrapper; typically hand-rolled with `@uiw/react-codemirror` or similar, more assembly required |
| Familiarity | Looks and feels like VS Code — candidates practicing for real interviews recognize it immediately | Looks like a plain, lightweight code box unless heavily styled |

## Recommendation: Monaco, via `@monaco-editor/react`

Reasoning:

- The bundle-size argument against Monaco doesn't actually bite here. The editor only needs to load on the `/interview/[id]/coding` route, not on `/interview/[id]` (voice) or anywhere else. `next/dynamic(() => import(...), { ssr: false })` keeps Monaco's weight entirely off every other page's bundle — this project already isn't shipping it into the voice tab, the dashboard, or the report page.
- Candidates get real syntax highlighting and bracket-matching for JS/TS/Python/Java/C++ with zero grammar-assembly work, which CodeMirror requires per-language.
- `@monaco-editor/react` removes the worst part of embedding Monaco by hand (worker `MonacoEnvironment` wiring) — `npm install @monaco-editor/react`, drop in `<Editor language="python" ... />`, done.
- This is a practice tool for interview prep specifically — Monaco *looking like* a real IDE / like what candidates will use in an actual onsite (CoderPad, HackerRank, VS Code) is a legitimate UX point in its favor, not just a technical one.
- Both are free/MIT, so licensing isn't a differentiator.

CodeMirror 6 would be the right call if this were an embedded snippet inside a page that also needs to stay light (e.g. a code block inside the voice chat transcript) — it is not the right call for a dedicated, full-tab code editor page.

---

# 3. Execution / Sandboxing Approach

This is the hardest part of the feature and the one most likely to be under-scoped if rushed. The constraint is: **never execute untrusted candidate code inside the Next.js app itself** (Vercel serverless functions are not a sandbox for arbitrary `eval`/`subprocess` — this would be a straightforward RCE surface). Something purpose-built has to run the code.

## Options considered

### 3.1 Piston (hosted public instance)
Piston (`engineer-man/piston`) is a free, open-source, multi-language execution engine (70+ languages) used by several public code-runner tools. There is a public instance at `emkc.org`.

- **Current status (checked directly against the project's own repo README): the public `emkc.org` API is no longer freely open.** As of Feb 15, 2026, access requires requesting an API key from the maintainer on Discord, and keys are only granted for non-commercial, low-volume, largely educational use — explicitly *not* for individual/portfolio projects. Before that date it was open at 5 req/s with no key. That door has closed. Do not build a design that depends on hitting the public instance without first securing a key, and don't assume the policy is static — check current status before committing to this path.

### 3.2 Piston (self-hosted)
Piston itself remains fully open-source (MIT) and free to self-host indefinitely — the change above only affects the *maintainer's own hosted instance*, not the software.

- Ships as a Docker container. The catch: Piston's sandboxing (`isolate`) needs direct access to Linux cgroups and runs the container in `--privileged` mode. This is a real constraint, not a formality — **standard PaaS containers (Railway, Render, Fly.io) explicitly block this.** Documented failures exist for exactly this reason (cgroup creation errors, "Failed to create control group") when people try to deploy Judge0/Piston on Railway. Render and Fly.io have the same fundamental limitation — none of them expose privileged/`CAP_SYS_ADMIN` containers on their standard plans.
- What *does* work: an actual VM with root access, not a container platform. **Oracle Cloud "Always Free" tier** is the concrete free option — it hands out real Ampere ARM VMs (as of a mid-2026 tier reduction: 2 OCPUs / 12GB RAM total, split across up to 2 instances) with full root, which is enough to run `docker run --privileged` for Piston. This is genuinely free (no time limit, no credit-card-triggered charge), but it is infrastructure you now own and operate — OS patching, Docker upgrades, uptime, and OCI's well-documented "out of capacity" friction when first provisioning a free-tier instance in a popular region.

### 3.3 Judge0 (self-hosted vs. RapidAPI-hosted)
Judge0 (`judge0/judge0`) is the other major open-source execution engine, GPLv3-licensed.

- **Self-hosted via Docker: free, unlimited executions.** GPLv3 permits self-hosting and commercial use; the license's only real bite is that if you distribute *modified* Judge0 source, you must share those modifications — it doesn't restrict running it privately behind your own API. Same privileged-container caveat as Piston applies (Judge0 also shells out to `isolate` and needs cgroup access) — same Oracle-Cloud-style VM requirement, not a PaaS deploy.
- **RapidAPI-hosted ("Judge0 CE" on RapidAPI):** has a free Basic tier, paid tiers beyond that (documented around $10/mo for a mid tier with ~200ms average exec time, 99.9% uptime SLA). This is the "don't want to run infra at all" option, but it's a third-party dependency with a paid ceiling, and the free tier's request quota is low enough that it's realistically a prototyping tier, not a production one.
- Judge0 has broader language/version coverage than Piston and a more mature submission/status API (`in_queue`/`processing`/`accepted`/`wrong_answer`/etc. status codes) that map cleanly onto "test case passed/failed" semantics.

### 3.4 In-browser execution (WebAssembly) — code never leaves the client
For a subset of languages, skip server-side execution entirely:

- **Pyodide** — CPython compiled to WebAssembly, runs fully client-side. ~15MB WASM runtime downloaded once (cached after), sandboxed (no filesystem/socket access by default), supports the full language plus a large chunk of the PyPI ecosystem via `micropip`. This is a legitimate way to grade **Python** submissions with zero server cost and zero sandboxing risk — the code runs in the candidate's own tab.
- **QuickJS-in-WASM** (e.g. `@sebastianwessel/quickjs`) — same idea for **JavaScript/TypeScript**: a WASM-sandboxed JS engine, isolated from the host page's `window`/`fetch`/cookies (when configured correctly — some wrappers expose `fetch` to guest code by default and that must be explicitly disabled for untrusted code).
- No equivalent exists for compiling and running arbitrary **Java or C++** entirely client-side at reasonable bundle cost — that still needs a real compiler/runtime, which is what Piston/Judge0 are for.

## Recommendation

**[V1] JavaScript runs entirely in-browser (QuickJS-WASM) — this is the whole v1 execution story.** No server-side execution path exists at launch. Concretely:

- The candidate's submitted function plus a small test-harness script both run inside a QuickJS instance compiled to WebAssembly, in a dedicated Web Worker.
- The worker has no `window`, `fetch`, `document`, or `localStorage` — it cannot see cookies, make network calls, or touch anything outside itself, even a deliberately malicious submission.
- The harness calls the candidate's function once per test case and compares the return value to the expected output — see Section 5.1 for the pass/fail mechanics.
- A hard timeout on the worker (e.g. `setTimeout(() => worker.terminate(), 5000)`) is what actually stops an infinite loop — WASM execution doesn't preempt itself, so this has to be enforced from the host page, not from inside the sandbox.
- **Zero infrastructure, zero hosting decision, zero ongoing cost.** This is what makes JS-only a real "ship it" launch scope rather than a partial build waiting on the rest of the hybrid.

**[Future] Java, C++, Python (compiled/interpreted server-side languages) run against a self-hosted Piston instance**, once JS-only is validated and additional languages are prioritized:

1. Self-hosted Piston on a free-tier real VM (Oracle Cloud Always Free, or a $4–6/mo VPS if OCI capacity/region friction is a blocker). Piston over Judge0: fewer moving parts, simpler HTTP API, and this project doesn't need Judge0's enterprise feature set at this scale. Revisit Judge0 if language coverage or submission-status granularity becomes a real limitation.
2. **Do not depend on the public Piston instance** — treat it as unavailable given the current access policy (Section 3.1). A Discord-granted key is a fine fallback if obtained later for genuinely non-commercial use, but the design must not assume it.
3. Enforce per-submission timeouts (5–10s) and memory caps at the execution-engine config level (both Piston and Judge0 support this) — same reasoning as the WASM worker timeout above, just server-side.
4. Python could also stay in-browser via Pyodide (Section 3.4) rather than going through Piston at all, if/when Python support is added — worth deciding at that time rather than defaulting every non-JS language to the server path.

---

# 4. Problem Sourcing

Two real constraints: problems need **correct, verified test cases**, and they need to be **legally redistributable**. LeetCode/HackerRank problem statements and test data are not freely redistributable — scraping them is both a ToS violation and a copyright risk, and this project should not build on that.

## 4.1 Curated seed bank (launch content)

**DeepMind's CodeContests dataset** (Hugging Face: `deepmind/code_contests`) is the concrete, actually-free option: competitive-programming problems with paired input/output test cases plus reference solutions, released under **CC BY 4.0** (attribution required, otherwise free to use — including commercially). This is real, usable seed content, not a placeholder. A few hundred problems tagged by difficulty/topic, filtered down to ones with reasonably short, self-contained statements (competitive-programming problems can be denser than a typical interview question), is enough to seed `codingProblems` at launch. Attribution string goes in `codingProblems.sourceAttribution` per problem (see schema below) — CC BY requires it, and having the column also keeps the door open to mixing in other CC-licensed sources later without a schema change.

Other datasets surfaced in research (for awareness, not recommended as the primary source): `codeparrot/apps` (curated from Codewars/AtCoder/Kattis/Codeforces, mixed licensing per-problem — needs per-item license verification, more effort than CC BY 4.0's blanket clarity) and `open-r1/codeforces` (ODC-By 4.0, Codeforces-specific, similarly attribution-gated).

## 4.2 AI-generated problems (fills gaps CodeContests doesn't cover, e.g. resume/JD-specific topics)

Claude can generate a problem statement + test cases on demand (e.g. "generate a medium-difficulty array/two-pointer problem" to match a topic the Planner flagged as weak). The honest finding from current research: **raw LLM-generated test cases are not reliable enough to trust blind.** Documented failure rates in the 15–65% range for invalid/hallucinated test cases across benchmarks, and a well-known failure mode where a generated "test" never actually exercises the bug it's meant to catch.

Mitigation that's actually tractable to build, not aspirational:

1. Claude (Sonnet 5 — same tier as `gap-analysis.ts`, this needs real reasoning, not extraction) generates: problem statement, constraints, **and two independent reference solutions** in the tool-forced-JSON pattern already used by `extractStructured`.
2. Both reference solutions are run against a generated batch of test inputs (including edge cases the prompt explicitly asks for: empty input, single element, max-constraint size, duplicates).
3. **A test case is only accepted into `codingTestCases` if both independent solutions agree on the output.** Disagreement means either a solution is wrong or the problem statement is ambiguous — reject and regenerate rather than trust one solution blindly.
4. This is the same "don't trust a single model pass for anything correctness-critical" instinct the project already applies elsewhere (structured tool-forced extraction instead of prose parsing, `strict: true` schemas) — just applied to code correctness instead of JSON shape.

This makes AI-generated problems a real (if narrower and slower to produce) supplement, not the primary bank — CodeContests should carry launch content, with AI generation used to target specific topics the Planner wants and to grow the bank over time.

## 4.3 What not to do

Do not scrape LeetCode/HackerRank/CodeSignal problem text or test data. Do not present AI-generated test cases as "verified" without the dual-solution cross-check in 4.2 — an unverified generated test case that's simply wrong will silently and unfairly fail a correct candidate submission, which is worse than having fewer problems.

---

# 5. Grading / Evaluation Flow

Two complementary signals, combined into one score — same "don't trust one signal alone" pattern the Evaluation Agent already uses (technical + communication + completeness + confidence + problem-solving, not one flat score).

## 5.1 Deterministic test-case pass/fail

- On **Run**: execute against `isSample = true` test cases only (visible to the candidate, shown as pass/fail with actual vs. expected output — this is the "debug your solution" loop).
- On **Submit**: execute against *all* test cases for the problem (sample + hidden). Store a `passedCount` / `totalCount` and per-test result in `codingSubmissions`.
- `testScore = round(100 * passedCount / totalCount)`.

This is the trustworthy part of the score — it's not a language model's opinion, it's the code actually running.

## 5.2 LLM code review (optional, additive)

After a submission, Claude reads the submitted code (not the test results) and comments on:

- **Correctness reasoning** — does the approach make sense, independent of whether it happened to pass the given tests (catches "passes by luck" solutions, e.g. hardcoding for small inputs).
- **Time/space complexity** — stated informally (e.g. "O(n log n), appropriate for the constraints").
- **Code quality** — naming, structure, obvious anti-patterns.
- **Edge case handling** — whether the submission visibly guards against the edge cases the problem implies, even ones not directly covered by the test bank.

Model tier: **Sonnet 5**, same tier as `gap-analysis.ts` and the live Interview Agent — this is a judgment call over a single, bounded piece of text (the submission), not a bulk-extraction task (Haiku) and not something that needs to wait for the full end-of-interview Opus pass. Follows the exact `extractStructured` tool-forced-JSON pattern already in `packages/ai-core/src/client.ts`, with a zod schema for the review output (mirrors `gapAnalysisSchema`'s shape: scores + string fields, not free prose).

`reviewScore` = an average of complexity/quality/edge-case sub-scores the model returns (0–100 each, same convention as `evaluations.technicalScore` etc.).

## 5.3 Combined score

```
submissionScore = round(0.7 * testScore + 0.3 * reviewScore)
```

70/30 weighting toward the deterministic signal because it's the one that can't be gamed or hallucinated — the AI review is meant to catch things test cases structurally can't (style, complexity, "got lucky" solutions), not to be the primary grade. This weighting is a starting point, not something to treat as settled — see Open Questions.

At interview end, the Coach Agent (Opus, unchanged tier — this already runs once, async, after the interview) receives the coding round's submissions/scores as additional context alongside the voice transcript, the same way it already receives resume/JD/answer-evaluation context, and folds a `codingScore` into the final report (Section 6 shows the additive schema change).

---

# 6. Proposed Schema Additions

Follows the existing file's conventions exactly: `uuid` PKs via `defaultRandom()`, `pgEnum` for closed vocabularies, `onDelete: "cascade"` on every child-of-interview/child-of-problem FK, `jsonb` for structured-but-not-relational blobs, comments explaining *why* a field exists the way the current file does for `parentQuestionId`, `embeddingStatus`, etc.

```ts
// ---------------------------------------------------------------------------
// Coding Round — problems, assigned "rounds" per interview, submissions,
// and their evaluation. Mirrors the questions -> answers -> evaluations
// chain already used for the voice round (Section 13 of LLD.md), so the
// coding round is a second, independent instance of the same pattern rather
// than a bolt-on shape.
// ---------------------------------------------------------------------------

export const codingProblemSourceEnum = pgEnum("coding_problem_source", [
  "curated",      // seeded from a permissively-licensed dataset (e.g. CC BY 4.0)
  "ai_generated", // generated by Claude; only test cases that passed the
                   // dual-reference-solution cross-check (Section 4.2) are stored
]);

export const codingProblems = pgTable("coding_problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  difficulty: interviewDifficultyEnum("difficulty").notNull(),
  // Free-text topic tag (e.g. "arrays", "graphs") — mirrors questions.topic
  // rather than introducing a second taxonomy.
  topic: text("topic").notNull(),
  prompt: text("prompt").notNull(),
  constraints: text("constraints"),
  // Per-language starter code / function signature, e.g.
  // { python: "...", javascript: "...", java: "...", cpp: "..." }.
  // Not all languages need an entry — the UI falls back to a blank editor.
  // [V1] only the "javascript" key is ever populated — the shape is kept
  // multi-language from day one so adding Java/C++/Python later (Section 3
  // "Future") is a data-seeding task, not a schema migration.
  starterCode: jsonb("starter_code").notNull().default({}),
  source: codingProblemSourceEnum("source").notNull(),
  // Required (checked at seed time, not DB-enforced) when source = "curated"
  // — CC BY-style licenses require attribution. Nullable because
  // ai_generated problems have no external attribution to record.
  sourceAttribution: text("source_attribution"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const codingTestCases = pgTable("coding_test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  problemId: uuid("problem_id")
    .notNull()
    .references(() => codingProblems.id, { onDelete: "cascade" }),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  // Sample cases are shown to the candidate pre-submit (the "Run" button,
  // Section 5.1); non-sample cases are hidden and only run on Submit.
  isSample: boolean("is_sample").notNull().default(false),
  order: integer("order").notNull(),
});

// Represents "this problem was assigned into this interview's coding round"
// — the coding-round equivalent of the `questions` table. Kept as its own
// table (rather than inferring assignment from the first submission) so the
// round's problem set and ordering exist even before the candidate writes
// any code, same reasoning as why `questions` rows exist before `answers`.
export const codingRoundQuestions = pgTable("coding_round_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviews.id, { onDelete: "cascade" }),
  problemId: uuid("problem_id")
    .notNull()
    .references(() => codingProblems.id),
  order: integer("order").notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const codingSubmissionStatusEnum = pgEnum("coding_submission_status", [
  "running",  // sent to the execution engine, awaiting result
  "graded",   // deterministic test results recorded (Section 5.1)
  "reviewed", // AI code review also complete (Section 5.2) — terminal state
  "error",    // execution engine returned a compile/runtime error, not a
              // pass/fail result — distinct from "graded with 0 passed"
]);

export const codingSubmissions = pgTable("coding_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundQuestionId: uuid("round_question_id")
    .notNull()
    .references(() => codingRoundQuestions.id, { onDelete: "cascade" }),
  // "python" | "javascript" | "java" | "cpp" — validated at the API layer
  // (Zod), not DB-enforced, since the supported-language list will grow
  // without a migration.
  language: text("language").notNull(),
  code: text("code").notNull(),
  status: codingSubmissionStatusEnum("status").notNull().default("running"),
  // Per-test-case results: [{ testCaseId, passed, actualOutput, stderr, runtimeMs }]
  testCaseResults: jsonb("test_case_results").notNull().default([]),
  passedCount: integer("passed_count").notNull().default(0),
  totalCount: integer("total_count").notNull().default(0),
  // 0-100, see Section 5.3. Nullable until status reaches at least "graded".
  score: integer("score"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

// Mirrors `evaluations` (one row per graded answer) — one row per reviewed
// submission. Kept separate from `codingSubmissions` rather than adding
// columns there, same reasoning LLD Section 13 gives for splitting
// Evaluation out of Answer: the review is a distinct, possibly-absent,
// possibly-async-completed step.
export const codingEvaluations = pgTable("coding_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .unique()
    .references(() => codingSubmissions.id, { onDelete: "cascade" }),
  correctnessNotes: text("correctness_notes"),
  complexityScore: integer("complexity_score"),
  codeQualityScore: integer("code_quality_score"),
  edgeCaseScore: integer("edge_case_score"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

## Additive change to an existing table

```ts
// reports — add one nullable column. Nullable/additive so existing rows
// (interviews with no coding round) read fine with codingScore = null; the
// report UI simply omits the coding section when it's absent.
codingScore: integer("coding_score"),
```

## Relations (additions to the existing `relations()` blocks, same style)

```ts
export const codingProblemsRelations = relations(codingProblems, ({ many }) => ({
  testCases: many(codingTestCases),
  roundQuestions: many(codingRoundQuestions),
}));

export const codingRoundQuestionsRelations = relations(codingRoundQuestions, ({ one, many }) => ({
  interview: one(interviews, { fields: [codingRoundQuestions.interviewId], references: [interviews.id] }),
  problem: one(codingProblems, { fields: [codingRoundQuestions.problemId], references: [codingProblems.id] }),
  submissions: many(codingSubmissions),
}));

export const codingSubmissionsRelations = relations(codingSubmissions, ({ one }) => ({
  roundQuestion: one(codingRoundQuestions, {
    fields: [codingSubmissions.roundQuestionId],
    references: [codingRoundQuestions.id],
  }),
  evaluation: one(codingEvaluations, { fields: [codingSubmissions.id], references: [codingEvaluations.submissionId] }),
}));
```

Note on multiple attempts: `codingSubmissions` intentionally allows more than one row per `roundQuestionId` (the candidate can re-run/re-submit). "Current" score for the round is the latest row by `submittedAt` per `roundQuestionId` — no `isFinal` flag needed at this scope; add one only if "submit counts once, no resubmission" becomes an actual product requirement.

---

# 7. Integration Into the Existing App

## 7.1 Not a new `interviewType` enum value

`interviewTypeEnum` (`technical | resume | experience | hr | mixed`) governs what the **voice** Interview Agent talks about — it's a conversational-style flag consumed by `processTurn`. A coding round is orthogonal to that: a `technical`-type interview and a `mixed`-type interview should both be able to optionally carry a coding round. Recommendation: **do not add a `coding` value to this enum.** Instead:

```ts
// interviews — additive, nullable-effectively-boolean-with-default column.
codingRoundEnabled: boolean("coding_round_enabled").notNull().default(false),
```

Set at interview-setup time (same form as duration/difficulty/type today). This keeps the voice orchestrator's `InterviewType` union exactly as-is — nothing in `packages/orchestrator/src/index.ts` or `processTurn` needs to know this feature exists.

## 7.2 New route/page

```
apps/web/src/app/interview/[id]/coding/page.tsx      (server component, loads assigned problems)
apps/web/src/app/interview/[id]/coding/coding-tab.tsx (client component, Monaco + run/submit UI)
```

`apps/web/src/app/interview/[id]/page.tsx` (currently renders `<VoiceChat>` directly) gains a small tab bar — `Interview | Coding | Report` — shown only when `interview.codingRoundEnabled`. This is the "separate tab" structure the feature is scoped to; `voice-chat.tsx` itself needs zero changes.

## 7.3 New API routes

```
POST /api/interviews/[id]/coding/assign         # picks N problems (topic-matched to weak areas
                                                  # from interviewStates.weakTopics if available,
                                                  # else difficulty-matched), creates codingRoundQuestions
GET  /api/interviews/[id]/coding                 # list assigned problems + latest submission per problem
POST /api/interviews/[id]/coding/[problemId]/run     # sample tests only, calls execution engine (or
                                                       # returns "run client-side" instruction for
                                                       # Python/JS — see 7.4)
POST /api/interviews/[id]/coding/[problemId]/submit  # all tests + triggers async AI review
```

`/run` and `/submit` both write to `codingSubmissions`; `/submit` additionally kicks off the Sonnet 5 review (Section 5.2) — fire-and-forget from the route handler, same pattern `voice-chat.tsx` already uses to kick off report generation without blocking on it (`fetch(...).catch(() => {})`), with the client polling `GET /coding` for the review to land.

## 7.4 Where "run" actually executes

**[V1]: always in-browser.** Every submission is JavaScript, so `language` is effectively a constant — the client-side QuickJS engine runs it directly in the browser (Section 3.4), and `/run` / `/submit` exist purely to persist the result (`testCaseResults`, `passedCount`, `score`) and to kick off the async AI review, not to execute anything server-side. **This means the whole "coding round" backend for v1 is two thin persistence routes — no execution-engine integration code at all.**

**[Future]** once additional languages ship: `language === "java" | "cpp"` (or any language without an in-browser path) has the API route forward to the self-hosted Piston instance instead. Same Run/Submit buttons regardless of language — the split stays invisible to the candidate — but this is new integration work, not something v1 needs to build against speculatively.

## 7.5 Report page

`apps/web/src/app/interview/[id]/report/report-view.tsx` gains a "Coding Round" card, rendered only when `report.codingScore !== null`, showing per-problem pass rate and the AI review notes — same visual pattern as the existing per-answer evaluation display, not a new design language.

---

# 8. Cost / Hosting Summary

Same format as `LLD.md` Section 21.

## V1 (JS-only) — what actually gets spent

| Piece | Choice | Cost model |
|---|---|---|
| Code editor | Monaco Editor + `@monaco-editor/react` | Free, open-source (MIT), loaded only on the Coding tab |
| JS execution | QuickJS-in-WASM (in-browser) | Free — runs on the candidate's device, no server cost, no execution-engine hosting at all |
| Problem bank (seed content) | DeepMind CodeContests (Hugging Face) | Free, CC BY 4.0 — attribution required, stored per-problem in `sourceAttribution` |
| Problem generation (gap-filling) | Claude Sonnet 5, dual-solution cross-check (Section 4.2) | Usage-based (same Sonnet 5 spend bucket the project already has) |
| Code review evaluation | Claude Sonnet 5 (`extractStructured`, same pattern as `gap-analysis.ts`) | Usage-based |
| Final report fold-in | Claude Opus 4.8 (unchanged — Coach Agent already runs once, async) | Usage-based, no new tier introduced |

**V1 needs zero new infrastructure.** No VM, no Docker, no execution engine to operate, nothing beyond the Sonnet 5 usage this project already budgets for. This is the direct payoff of the JS-only decision.

## Future — added cost once Java/C++/Python (server-executed) ship

| Piece | Choice | Cost model |
|---|---|---|
| Java / C++ / other execution | Self-hosted Piston | Free software, but **not** deployable on Vercel/Railway/Render/Fly.io (all block the privileged/cgroup access it needs) |
| Execution-engine hosting | Oracle Cloud "Always Free" VM (Ampere ARM, ~2 OCPU/12GB as of a mid-2026 tier cut) | Free, but self-operated (patching, uptime) and subject to OCI's known free-tier capacity/region friction at signup |
| Execution-engine hosting (fallback) | Any low-cost VPS running Docker if OCI provisioning is a blocker | **Paid** (~$4–6/mo) — the honest fallback if the free VM path doesn't pan out |
| Python execution (alternative) | Pyodide (in-browser, WASM) — could skip Piston entirely for Python | Free — same in-browser story as JS |

No new categories of "must pay for this" are introduced beyond what Section 21 of `LLD.md` already accepts as unavoidable, and none of this future cost is incurred by shipping v1.

---

# 9. Open Questions / Risks

These need the project owner's input or a build-time decision — flagged rather than guessed:

1. ~~Self-hosting Piston is real infrastructure...~~ **Resolved — v1 launches JS-only, in-browser, zero infra** (see "Launch scope — decided" at the top of this doc). Piston/Java/C++ remain documented as the next step, not dropped, but are explicitly not part of the first build.
2. **[Future]** Oracle Cloud Always Free capacity is not guaranteed at signup — "out of host capacity" errors on free-tier Ampere instances in popular regions are a widely reported, unresolved friction point. Only relevant once Piston is actually being stood up (not a v1 concern) — worth a spike (attempt provisioning) before committing to this path over just paying for a small VPS.
3. **The 70/30 test-score/AI-review weighting (Section 5.3) is a starting guess, not a validated number.** Applies to v1 too (JS submissions still get both signals) — treat as a tunable constant, revisited once there's real submission data (are the two signals actually correlated, or is the AI review just restating the pass rate in prose?).
4. **AI-generated problem quality control (Section 4.2) adds real build cost** — dual-solution generation + cross-checking is more Claude calls and more logic than a single `extractStructured` call. Decide whether this ships in v1 or whether launch is CodeContests-only (curated, already-verified test cases) with AI generation added once the core round works end-to-end. Given v1 is already scoped down to JS-only, leaning CodeContests-only for the *very* first cut is the consistent call — worth confirming.
5. **Does the coding round score affect `reports.recommendation`, or is it informational-only alongside it?** The Coach Agent prompt needs an explicit instruction either way — silently blending it in changes what "recommendation" means for interviews that happen to have `codingRoundEnabled = true` vs. not, which is worth deciding deliberately rather than leaving to whatever Opus infers from added context. Applies starting from v1.
6. **[Future]** Rate limiting / abuse on the self-hosted execution engine. Not applicable to v1 (no server execution to abuse) — becomes relevant once Piston is live. The v1-equivalent concern is much smaller: should `/run`/`/submit` still rate-limit *persistence* writes to stop someone scripting thousands of submission rows? Worth a quick look even pre-Piston, but low stakes at this project's scale.
7. **[Future]** Security review before Piston goes live, even self-hosted and even for a single user — sandbox escapes in code-execution engines are a known bug class (Judge0 has had documented sandbox-escape findings in the past). Not applicable to v1, since nothing executes server-side yet.
8. **[Future]** In-browser execution UX cost for *other* languages: Pyodide's ~15MB first-load download would give a Python "Run" a real, user-visible first-load delay. Doesn't apply to v1 — QuickJS (JS) is a much smaller WASM payload than Pyodide, but it's still worth prefetching the WASM module as soon as the Coding tab mounts (before the candidate finishes reading the problem) rather than waiting for the first "Run" click, so the first execution doesn't have a surprise load delay either.
9. **[New] React/component question format (Section 10) is explicitly future scope, not a v1 stretch goal.** It needs a different sandbox (iframe, not QuickJS), a different test-case shape (DOM-interaction scripts, not input/output pairs), and likely hand-authored or AI-generated content since CodeContests has no UI-question equivalent. Don't let "we already have JS running in-browser" create pressure to bolt this on early — it's a separate build.

---

# 10. React / Component Questions (Future — Not V1)

Recorded here so the design exists when this is prioritized, but explicitly **out of v1**. This is not "JS support with a library added" — it changes two of the four load-bearing decisions in this doc (execution sandbox, test-case shape).

## Why QuickJS doesn't work for this

QuickJS-in-WASM (Section 3.4, the whole v1 execution story) is a bare JS engine — no `document`, no DOM, nothing to render into. A React component question needs to actually mount a component and inspect what it produces (does clicking a button update the count? does typing filter a list?). That requires a real DOM.

## The sandbox: a real `<iframe>`, not WASM

- `<iframe sandbox="allow-scripts">` — deliberately **without** `allow-same-origin`. The browser then treats the iframe as an opaque, unique origin: it cannot read the parent page's cookies, `localStorage`, or session, and the parent can't reach into it except via `postMessage`. This is a different isolation mechanism than QuickJS's WASM sandboxing, but an equivalent safety property — untrusted code that can't exfiltrate anything, just via a real browser context instead of a bare interpreter.
- React + ReactDOM ship as a small static bundle inside that iframe (self-hosted, not a runtime CDN dependency — consistent with how the rest of this app avoids depending on third-party uptime for anything load-bearing).
- The candidate's component code renders inside the iframe's real DOM.

## Grading: DOM-interaction scripts, not input/output pairs

A per-problem "test case" for a component question isn't `{input, expectedOutput}` — it's a small script that drives the rendered component and asserts on the result: `button.click()`, then check `.textContent`; type into an input, then check the filtered list. Closer to a lightweight Testing-Library/Cypress check than Section 5.1's function-call harness. Results still postMessage back to the parent page so the Run/Submit UI stays the same shape the candidate already knows from JS problems.

## What this means for the rest of the doc, when it's built

- **Schema**: `codingProblems` needs a second "kind" (e.g. `questionKind: "algorithm" | "component"`), and `codingTestCases`'s `input`/`expectedOutput` columns don't fit a component test — either a new table (`codingComponentChecks`) or a jsonb column shaped differently per kind. Decide at build time rather than guessing the shape now.
- **Problem sourcing (Section 4)**: CodeContests has no UI-question equivalent — component questions would need to be hand-authored or AI-generated from scratch, with the same "don't trust a single model pass" dual-verification instinct Section 4.2 already applies (here: does a known-correct reference component actually pass the generated test script?).
- **Grading (Section 5)**: the deterministic signal is now "did the DOM end up in the asserted state," not "did the return value match" — still a trustworthy pass/fail signal, just a different harness under the hood.

This is a real, buildable feature — the sandboxing story is solid and free — but it's sized like its own doc's worth of decisions, not a bullet point on top of the JS-only v1.
