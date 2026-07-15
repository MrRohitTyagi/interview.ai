# AI Interview Platform

Adaptive AI mock interviews — resume- and JD-aware, with dynamic follow-up
questions. See `LLD.md` for the full design.

## Stack

Turborepo monorepo, pnpm workspaces.

- `apps/web` — Next.js 15, TypeScript, Tailwind, shadcn/ui, Auth.js
- `packages/db` — Drizzle schema + Postgres client (shared by web and future workers)

## Getting started

### 1. Install dependencies

```bash
corepack enable pnpm
pnpm install
```

### 2. Set up a database

Create a free [Supabase](https://supabase.com) project (Postgres + pgvector,
free tier). Grab the connection string from Project Settings → Database.

### 3. Configure environment variables

```bash
cp .env.example apps/web/.env.local
```

Fill in at minimum:
- `DATABASE_URL` — from Supabase
- `AUTH_SECRET` — generate with `npx auth secret`

Google/GitHub OAuth and Resend (email OTP) are optional for local dev — email
OTP codes are logged to the server console if `RESEND_API_KEY` is unset.

### 4. Run migrations

```bash
pnpm db:generate   # regenerate SQL from packages/db/src/schema.ts if you change it
pnpm db:migrate    # apply migrations to your database
```

### 5. Start the dev server

```bash
pnpm dev
```

App runs at http://localhost:3000.

## Current status

Phase 1 foundation is scaffolded: auth (Google/GitHub/email-OTP), the full
database schema, and the landing/sign-in/dashboard shell. Resume upload, JD
upload, and Claude-based analysis are next — see `LLD.md` Section 19 for the
full phased roadmap.
