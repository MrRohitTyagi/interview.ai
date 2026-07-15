# AI Interview Platform – Low Level Design (LLD)

> Version: 2.0
>
> Tech Stack: Next.js + Claude APIs + Node.js + PostgreSQL (pgvector) + Redis
>
> Changelog from v1.0: consolidated vector store into Postgres, swapped paid/ambiguous infra for free-tier equivalents, fixed schema gaps (follow-up threading, per-answer evaluation, session-state persistence), added latency budget, split conversation memory into fast/slow tiers, added consent/compliance notes for the camera pipeline, reworked phases to build text-first before voice.

---

# 1. Vision

Build an adaptive AI interviewer that behaves like a real senior interviewer rather than a chatbot.

The platform should:

- Understand the candidate's resume.
- Understand the Job Description.
- Conduct a natural voice interview.
- Ask dynamic follow-up questions.
- Remember previous answers.
- Adapt difficulty in real time.
- Generate an in-depth hiring report.

Scope note: Phases 1-5 target a self-practice tool for candidates. Any employer-facing use (recruiter dashboards, team hiring) is deferred to Phase 6 and requires a separate compliance review — see Section 16A.

---

# 2. Core Goals

- Resume-aware interviews
- Real-time voice conversations
- Dynamic questioning
- Memory across the interview
- Recruiter-style evaluation
- Company-specific interview styles
- Detailed improvement roadmap

---

# 3. Technology Stack

## Frontend (free, open-source)

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI
- React Hook Form
- Zod
- TanStack Query
- Zustand
- Framer Motion
- react-pdf (preview)
- pdf.js

## Backend (free, open-source)

- Next.js Route Handlers (CRUD/API, deployed on Vercel)
- Fastify (dedicated always-on Node server for real-time/WebSocket work)
- Socket.IO
- BullMQ
- ioredis

## Database

- PostgreSQL with the `pgvector` extension — one database for both relational data and vector search, instead of running a separate vector DB.
- Drizzle ORM — lighter weight than Prisma, better TS inference, no separate query-engine binary.

Hosting: Supabase (free tier includes Postgres + pgvector enabled by default).

## Vector Storage

`pgvector` extension inside the same Postgres instance (see Section 9 for how it's actually used — sparingly, not in the live per-turn loop). No separate Qdrant deployment needed for the scope in this document.

## Storage

Supabase Storage (S3-compatible, free tier) for resume/JD files and audio recordings. Revisit AWS S3 + CloudFront only if scale/cost eventually justifies leaving Supabase.

## Authentication

- Auth.js (free, open-source)
- Google Login
- GitHub Login
- Email OTP (Resend free tier for transactional email)

---

# 4. AI Stack

These are the only genuinely usage-based (non-free) pieces of the stack — they're the core of the product, so cost isn't avoidable, only manageable. See Section 16B for a per-interview cost estimate before launch.

## LLM

Anthropic Claude API (`@anthropic-ai/sdk`)

- **Claude Sonnet 5** — the live, per-turn Interview Agent. Chosen for latency: it's the only Claude call that has to happen synchronously inside the voice loop.
- **Claude Opus 4.8** — Evaluation Agent and Coach Agent (scoring, final report). These run async/after the interview, so latency doesn't matter and reasoning depth does.
- Development note: use Anthropic's free trial credits to build and test Phases 1-3 before any production spend.

## Embeddings

Voyage AI (usage-based, has free starter credits). Used only for cross-session memory (Section 9) — not called during the live interview loop.

---

# 5. Voice Stack

Not free at production scale, but every provider below has a free tier or trial credit sufficient for development and small-scale testing.

## Speech To Text

1. **Deepgram** streaming (primary) — free trial credit to start, pay-as-you-go after. Chosen for streaming latency, word timestamps, confidence scores.
2. AssemblyAI streaming — fallback if Deepgram credits run out during dev.

STT confidence scores feed into Evaluation Agent's confidence scoring (Section 8) alongside speaking pace and filler-word rate (Section 17), instead of trying to infer confidence from text alone.

## Text To Speech

1. **ElevenLabs** — free tier (10k characters/month) sufficient for dev/testing, paid beyond that. Multiple personas, streaming audio.
2. OpenAI TTS — cheaper paid fallback if ElevenLabs free tier is exhausted.

---

# 6. Real-Time Communication

Transport

- WebSocket (Socket.IO), hosted on a dedicated always-on Fastify server (Railway or Fly.io free/hobby tier) — Vercel cannot host long-running WebSocket connections.

Events

- interview_created
- mic_ready
- camera_ready
- question_started
- transcript_partial
- transcript_final
- evaluation_started
- ai_thinking
- ai_speaking
- next_question
- interview_completed
- report_ready
- **connection_lost** — client detects a dropped socket
- **reconnect_attempt** — client retrying
- **session_state_restored** — server sends the persisted `InterviewState` (Section 13) back to the client after reconnect
- **error** — generic recoverable-error channel (STT/TTS/Claude failure mid-turn)

Reconnection is a first-class case, not an edge case: live interviews run 30-60 minutes over real networks. `InterviewState` is persisted after every turn (Section 7) specifically so a dropped connection doesn't lose the interview.

---

# 7. Major Modules

## Authentication

Responsibilities

- Login, Signup, Session, JWT, RBAC (roles: `candidate` today; `recruiter`/`admin` reserved for Phase 6)

Libraries

- Auth.js, Drizzle, bcrypt

---

## Resume Service

Input: PDF, DOCX

Pipeline

Upload → check for extractable text layer → **if none found, run OCR via Tesseract.js (free, open-source, runs in a background worker)** → Extract text → Claude Resume Analysis → Chunking → Embeddings → Store in pgvector → Generate Candidate Profile

Output

- Skills, Companies, Projects, Achievements, Technologies, Claims, Weak Areas, Strong Areas, Suggested interview topics

Libraries

- pdf-parse, mammoth, tesseract.js, langchain-textsplitters

Constraints

- File size limit + MIME-type validation enforced at upload (Zod + server-side check), not just relying on the client.

---

## JD Service

Extract: Required skills, Experience, Seniority, Responsibilities, Preferred technologies

Generate: Gap Analysis, Resume Score, Interview Focus

`JobDescription` is now its own table (Section 13) rather than an implicit foreign key with no defined source record.

---

## Interview Planner

Inputs: Resume, JD, Difficulty, Interview Type, Duration

Outputs: Interview Plan — Introduction → Resume Discussion → Technical Round → Deep Dive → Architecture → Behavioral → Wrap-up

Planner ensures

- Balanced topics
- Progressive difficulty
- No duplicate questions — deduplication is checked both within the current session and against the user's own past-interview question history (via cross-session memory, Section 9), so retaking a practice interview doesn't repeat the same questions.

---

## Interview Orchestrator

Central state machine. Never calls Claude directly — instead coordinates AI agents.

Maintains (and persists after every turn to `InterviewState`, Section 13, for reconnection):

- Current question, remaining time, covered topics, confidence, weak topics, conversation memory (in-session tier only, Section 9)

### Latency Budget

Target: **under 2.5 seconds** from "candidate stops speaking" to "interviewer's audio starts playing." This number governs the sync/async split below — without it, the multi-agent architecture in Section 8 has no way to decide what can run in the live loop.

- **Synchronous, in the live loop:** STT transcript → Interview Agent (Claude Sonnet 5, one call) → TTS. This is the only Claude call blocking the candidate's next turn.
- **Async, off the live loop:** Evaluation Agent scores the *previous* answer while the candidate is already hearing the next question. Planning Agent runs once at session start, not per-turn. Coach Agent runs after the interview ends.
- **In-session memory** is read from Redis-held state (fast), not from a vector search — see Section 9.

---

# 8. Multi-Agent Architecture

## Resume Agent
Produces candidate summary, claims, possible follow-up questions.

## Planning Agent
Produces interview timeline, topic distribution. Runs once per session (not per-turn).

## Interview Agent
Speaks, listens, asks questions, asks follow-ups. No scoring. The only agent that runs synchronously inside the live per-turn loop (Section 7).

## Evaluation Agent
Scores technical correctness, communication, completeness, confidence, problem solving — for each answer, async/off the live loop. "Confidence" is derived from STT confidence scores, speaking pace, and filler-word rate (Section 17) in addition to transcript content, not inferred from text alone.

## Coach Agent
Produces final report, study roadmap, recommended resources. Runs after the interview ends.

---

# 9. Conversation Memory

Split into two tiers to keep the live loop fast:

**In-session memory (fast, synchronous)** — held in Redis for the duration of the interview as structured objects: question, answer summary, technologies mentioned, mistakes, confidence, follow-up opportunities. This is what the Interview Agent reads on every turn.

**Cross-session memory (slow, async, optional)** — after an interview ends, structured memory is persisted to `pgvector`. Retrieved via semantic search only when a *new* interview starts for the same user (e.g. "avoid repeating past questions," "revisit past weak areas") — never inside the live per-turn loop, since that would add a vector-search round trip on top of the STT→Claude→TTS chain.

---

# 10. Voice Pipeline

Microphone → Noise Suppression → Voice Activity Detection (incl. silence timeout for end-of-turn detection — this is core V1, not a future item, since basic turn-taking is impossible without it) → Streaming STT → Transcript → Claude → Response → TTS → Speaker

Future (genuinely deferred — natural interruption handling is a hard real-time problem in its own right)

- Interruptions / barge-in

---

# 11. Camera Pipeline

Camera is **not** sent to Claude, and face/attention detection runs **client-side in the browser** (MediaPipe or face-api.js, both free/open-source) — video frames never leave the device, which keeps this cheap and reduces privacy exposure.

Used for (Phase 1-3, self-practice tool only)

- Face detected
- Looking away
- Attention score — shown to the candidate themselves, as practice feedback

Constraints

- Explicit consent screen before the camera is enabled, in plain language, before any interview using it can start. Consent is logged (`ConsentLog`, Section 13).
- Attention/presence signals are **excluded** from any report shown to a third party (recruiter) until a legal review is completed — see Section 16A. They're informational for the candidate only through Phase 5.
- No emotion detection in the current scope. Automated emotion inference in employment-adjacent contexts carries real regulatory risk (e.g. EU AI Act treats it as restricted in employment); only reconsider this with a legal review if it's ever prioritized for Phase 6.

---

# 12. Prompt Engineering

Never use one huge prompt.

Prompt = System Prompt + Resume Context + JD Context + Conversation Memory + Interview State + Current Goal

All resume/JD text is user-supplied and untrusted: before it's inserted into any prompt, it's wrapped in clearly delimited context blocks and scanned for instruction-like patterns ("ignore previous instructions," etc.) so it can never be interpreted as a system-level directive. This is the concrete implementation of the "Prompt injection sanitization" requirement in Section 16.

---

# 13. Database (Drizzle / Postgres)

**User**
- id, name, email, organizationId (nullable — reserved for Phase 6 team hiring), createdAt

**Organization** *(new — unused until Phase 6, added now to avoid a painful migration later)*
- id, name, createdAt

**Resume**
- id, userId, url, parsedJson, embeddingStatus

**JobDescription** *(new — previously an undefined `jdId` reference)*
- id, userId, rawText, parsedJson

**Interview**
- id, userId, resumeId, jdId, duration, difficulty, status

**InterviewState** *(new — persists orchestrator live state for reconnection, Section 6/7)*
- id, interviewId, currentQuestionId, remainingTimeSeconds, coveredTopics (json), weakTopics (json), updatedAt

**Question**
- id, interviewId, parentQuestionId (nullable, self-relation — represents follow-up threads, previously missing), topic, difficulty, question, order

**Answer**
- id, questionId, transcript, audioUrl

**Evaluation** *(new — replaces a single flat `Answer.score`, since the Evaluation Agent produces five sub-scores)*
- id, answerId, technicalScore, communicationScore, completenessScore, confidenceScore, problemSolvingScore, notes

**Report**
- id, interviewId, status (pending / generating / ready / failed — previously missing, needed to back the `report_ready` event), technicalScore, communicationScore, recommendation, studyRoadmap (json)

**ConsentLog** *(new — backs the camera consent requirement in Section 11)*
- id, userId, interviewId, cameraConsent (bool), consentedAt

---

# 14. Folder Structure

apps/
- web
- api
- workers

packages/
- ui
- prompts
- ai-core
- voice
- shared
- config
- types

services/
- auth
- resume
- planner
- interview
- reporting
- storage

---

# 15. Background Jobs

BullMQ Queues

- Resume Processing
- Embedding Generation
- Report Generation
- Email
- Cleanup
- Analytics

All jobs must be idempotent and configured with retry/backoff — LLM and third-party API calls fail transiently, and a report or embedding job re-run must not duplicate data or double-charge an API call.

---

# 16. Security

- Rate limiting
- Helmet
- CORS
- Signed URLs (Supabase Storage signed URLs)
- JWT
- Input validation (Zod)
- Prompt injection sanitization (Section 12)
- Audit logs
- Encryption at rest (handled by Supabase/Postgres by default)
- **Data retention & deletion** — user-triggered "delete my account and data" flow removes resumes, transcripts, and embeddings (GDPR-style right to erasure)
- **Secrets management** — API keys (Claude, Deepgram, ElevenLabs, Voyage) live in the hosting platform's secret store (Vercel/Railway/Supabase environment variables), never committed to the repo

## 16A. Compliance note (Phase 6 gate)

"Recruiter Dashboard" and "Team Hiring" (Section 18) move this product from self-practice into employer-facing automated hiring evaluation. That triggers real regulatory obligations in some jurisdictions (e.g. NYC Local Law 144 bias audits, EU AI Act high-risk employment AI rules). **Do not enable any employer-visible score or recommendation until this review happens.** Nothing in Phases 1-5 depends on this being resolved first.

## 16B. Cost note

Claude, Deepgram, and ElevenLabs are usage-based. Before any public launch, model the cost of one full 45-60 minute voice interview (STT streaming minutes + Claude tokens for Sonnet per-turn calls + Opus report generation + TTS characters) so pricing/rate-limits can be set deliberately rather than discovered after the first bill.

---

# 17. Analytics

Track

- Interview completion
- Average score
- Weak topics
- Speaking speed
- Filler words
- Session duration

Speaking speed, filler words, and STT confidence are also fed into the Evaluation Agent's confidence scoring (Section 8) — this list isn't just for dashboards, it's an input to evaluation.

---

# 18. Future Features

- Live Coding Round (Monaco Editor)
- AI System Design Round
- Whiteboard
- Company Personas
- Recruiter Dashboard *(gated on 16A)*
- Team Hiring *(gated on 16A)*
- ATS Resume Review
- Learning Dashboard
- Weekly Progress
- AI Mentor

---

# 19. Suggested Development Phases

**Phase 1 — Foundation**
- Auth, Resume upload + parsing (incl. OCR fallback), JD upload + parsing, Claude resume/JD analysis, gap analysis

**Phase 2 — Text-based adaptive interview**
- Interview Planner, Interview Orchestrator, Interview Agent over text chat, in-session (Redis) memory, follow-up question threading

This proves out the adaptive-questioning "brain" without voice's latency and infra complexity in the way.

**Phase 3 — Evaluation & Reporting**
- Evaluation Agent, Coach Agent, Report generation, dashboard

**Phase 4 — Voice**
- Voice pipeline latency spike (prototype STT→Claude→TTS in isolation, measure against the 2.5s budget in Section 7, *before* integrating)
- Wire voice into the already-working text orchestrator from Phase 2
- Camera pipeline (client-side, consent-gated)

**Phase 5 — Advanced**
- Company personas, coding round, system design round, cross-session memory (pgvector semantic recall)

**Phase 6 — Employer-facing** *(requires 16A compliance review first)*
- Recruiter dashboard, team hiring, ATS resume review

---

# 20. Nice-to-Have Engineering (all free/open-source)

- Turborepo
- ESLint
- Prettier
- Husky
- lint-staged
- GitHub Actions (free for this repo's scale)
- Docker
- Docker Compose
- OpenTelemetry
- Sentry (free tier)
- Pino logging
- Playwright
- Vitest
- React Testing Library
- Storybook

---

# 21. Library & Hosting Cost Summary

| Piece | Choice | Cost model |
|---|---|---|
| Frontend framework/UI | Next.js, React, Tailwind, shadcn/ui, Radix, RHF, Zod, TanStack Query, Zustand, Framer Motion | Free, open-source |
| Realtime server | Fastify + Socket.IO | Free, open-source |
| Background jobs | BullMQ + ioredis | Free, open-source |
| Database + vector search | Postgres + pgvector, via Drizzle | Free, open-source (Supabase free tier for hosting) |
| File storage | Supabase Storage | Free tier, S3-compatible |
| Auth | Auth.js + Resend (OTP email) | Free, open-source / free tier |
| OCR | Tesseract.js | Free, open-source |
| Client-side face detection | MediaPipe / face-api.js | Free, open-source |
| Hosting — frontend/API | Vercel | Free hobby tier to start |
| Hosting — realtime server | Railway or Fly.io | Free/hobby tier to start |
| Hosting — Redis | Upstash | Free tier |
| **LLM** | Claude Sonnet 5 / Opus 4.8 | **Usage-based** (free trial credits for dev) |
| **Embeddings** | Voyage AI | **Usage-based** (free starter credits) |
| **STT** | Deepgram | **Usage-based** (free trial credit) |
| **TTS** | ElevenLabs | **Usage-based** (10k chars/month free) |

Everything except the four bolded AI/voice APIs is free to build and host at this project's scale. Those four are unavoidable — they're what makes the interviewer intelligent and audible — but every one of them has a free tier or trial credit large enough to fully build and test Phases 1-4 before any real spend is required.

---

# 22. Long-Term Vision

A complete AI Interview Platform for engineers that can realistically simulate hiring loops for frontend, backend, full-stack, mobile, DevOps, AI, and system design interviews while providing actionable feedback and measurable progress over time.
