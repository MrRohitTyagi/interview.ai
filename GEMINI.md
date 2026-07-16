---
name: ai-interviewer-rules
description: Workspace-wide developer guidelines, architecture patterns, coding standards, and safety constraints for the AI Interviewer App.
trigger: always_on
---

# AI Interviewer App Customization Rules & Guidelines

Welcome! These rules customize Antigravity's behavior specifically for the **AI Interviewer App** workspace.

---

## 🏗️ Project Architecture & Stack

This is a **Turborepo monorepo** managed with **pnpm**. Below is the package structure:

*   **Applications:**
    *   `apps/web`: [Next.js](file:///Users/rohittyagi/Desktop/repos/ai-interviewer-app/apps/web) (Next.js v16.x, React 19) frontend using Tailwind CSS v4, Framer Motion, and NextAuth.
*   **Packages:**
    *   `packages/db`: [Database schema and migration setup](file:///Users/rohittyagi/Desktop/repos/ai-interviewer-app/packages/db) with Drizzle ORM and Supabase.
    *   `packages/ai-core`: [Core AI utilities and prompt models](file:///Users/rohittyagi/Desktop/repos/ai-interviewer-app/packages/ai-core).
    *   `packages/orchestrator`: [Interview orchestration logic](file:///Users/rohittyagi/Desktop/repos/ai-interviewer-app/packages/orchestrator).

---

## 🛠️ Commands & Scripts

Always use the workspace-level `pnpm` and `turbo` commands:

*   **Development:** `pnpm dev` (Runs `turbo run dev`)
*   **Build:** `pnpm build` (Runs `turbo run build`)
*   **Lint:** `pnpm lint` (Runs `turbo run lint`)
*   **Database Operations:**
    *   Generate Migrations: `pnpm db:generate`
    *   Run Migrations: `pnpm db:migrate`
    *   Open Drizzle Studio: `pnpm db:studio`

---

## 💻 Coding Standards & Conventions

### 1. React & Next.js (apps/web)
*   **Next.js 16 App Router:** Use modern layouts, pages, and route handlers.
*   **React 19:** Standard functional components, hooks, Server Components (default), and Client Components (`"use client"`) only where interactive state is required.
*   **Styling:** Tailwind CSS v4 is used. Use utility classes conforming to Tailwind v4. Avoid custom CSS inline styles unless absolutely necessary.
*   **Transitions:** Use `framer-motion` for fluid, premium transitions and interactions.
*   **Form Handling:** Use `react-hook-form` along with `@hookform/resolvers` and `zod` for validation.

### 2. Database & State (packages/db)
*   Use **Drizzle ORM** for database queries and mutations.
*   Always ensure schema definitions in `packages/db` are modular and typed.

### 3. TypeScript
*   Strict typing is required. Avoid `any`. Use custom interfaces/types and enforce proper return types for functions.
*   Keep files clean and compile-safe.

---

## 🔒 Safety & Git Constraints

*   **No Unapproved Commits:** Never run `git commit` or `git push` without explicit instruction.
*   **Branch Management:** Never create or switch git branches unless requested.
*   **State Constraints:** Ensure sandbox scripts and database migrations are run with safety controls.

---

## 💬 Communication & Response Style

*   **Concise and Technical:** Keep explanations clear, direct, and focused on code. Avoid unnecessary filler text.
*   **Direct Solutions:** Break complex procedures down into logical, incremental steps.
*   **Design for Wow:** When writing web components or UI logic, focus on rich, premium designs, subtle micro-animations, and clean typography.
