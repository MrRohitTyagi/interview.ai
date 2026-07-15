# Product

## Register

product

## Platform

web

## Users

Solo job candidates preparing for a real upcoming interview, practicing on their own — not recruiters, not hiring teams. A candidate uploads their own resume and a target job description, then works through a live, spoken mock interview alone, usually shortly before the real thing. Employer-facing use (recruiter dashboards, team hiring) is explicitly out of scope for now and deferred to a later phase behind a separate compliance review.

## Product Purpose

An adaptive AI mock-interview platform that behaves like a real senior interviewer rather than a fixed question bank or a chatbot. It reads the candidate's resume and the job description, plans an interview around the actual gaps between them, conducts a live spoken conversation with dynamic follow-ups that adapt to how well each answer lands, and produces a calibrated, honest report afterward. Success is a candidate who feels less nervous and more prepared walking into their real interview, because they've already done a realistic dry run — not just a checklist of questions answered.

## Positioning

Practice the conversation, not just the answers. Most mock-interview tools work off a static list; this one follows up, digs into weak answers, changes course mid-session, and pushes back — the way an actual senior interviewer would, not a script being read aloud.

## Brand Personality

Calm, professional, broadcast-caliber. The existing identity is deliberately named "on air" in code: warm graphite instead of stark near-black, one committed amber signal accent instead of a gradient, editorial serif headings instead of a generic sans-everywhere look. It should feel like a real recording studio — a tally light, a signal chain, a stage — not a hype-driven SaaS product.

## Anti-references

The generic 2025–2026 AI-product template: purple/blue gradient heroes, chat-bubble message UI with circular avatars, Inter or Space Grotesk as the default safe font, rounded-corner card grids repeated as the answer to every layout question. Side-stripe accent borders on cards and list items read the same way and should be avoided even when they'd be convenient. The product should never look interchangeable with an anonymous AI chatbot wrapper.

## Design Principles

Practice should feel like the real thing, not a simulation of one — the interview UI and the marketing preview of it must look and behave like the same product, not two separate designs that happen to share a name.

Never inflate or fake competence. Scores, gap analysis, and recommendations stay calibrated and honest even when the honest result is uncomfortable — the entire value of a practice report evaporates the moment it stops being trustworthy.

Default to free or low-cost infrastructure until there's a concrete, specific reason to pay for something — this shapes real architecture decisions (in-browser execution over paid compute, automatic fallback voice engines, free-tier services throughout), not just a cost note in a doc.

Never strand the user in a hidden failure state. Every fallible async step — voice synthesis, report generation, email verification, a resumed session — has a visible status and a concrete way forward (retry, resend, fallback), not a silent stall.

## Accessibility & Inclusion

WCAG 2.1 AA baseline across all text, contrast, and keyboard navigation. The live interview itself is inherently voice-dependent (the candidate speaks, the AI speaks back) — that's the core of the product's value, not an oversight, so it's a disclosed, known limitation rather than something to design around. Browsers without Web Speech API support are told clearly and immediately, rather than failing silently mid-session.
