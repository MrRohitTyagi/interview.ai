---
name: interview.ai
description: Adaptive AI mock interviews with a broadcast-studio identity — practice the conversation, not just the answers.
colors:
  studio-graphite: "oklch(0.17 0.017 55)"
  panel: "oklch(0.225 0.02 55)"
  ink: "oklch(0.94 0.015 75)"
  ink-muted: "oklch(0.68 0.03 65)"
  tally-amber: "oklch(0.75 0.14 60)"
  tally-amber-ink: "oklch(0.18 0.03 50)"
  slate-panel: "oklch(0.27 0.022 55)"
  hairline: "oklch(0.94 0.015 75 / 10%)"
  alarm: "oklch(0.62 0.16 30)"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "normal"
  title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.68rem"
    fontWeight: 500
    letterSpacing: "0.12em"
  label-sm:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.62rem"
    fontWeight: 500
    letterSpacing: "0.05em"
rounded:
  sm: "0.225rem"
  md: "0.3rem"
  lg: "0.375rem"
  xl: "0.525rem"
  pill: "9999px"
spacing:
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.tally-amber}"
    textColor: "{colors.tally-amber-ink}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  button-secondary:
    backgroundColor: "{colors.slate-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "2rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "2rem"
  button-destructive:
    backgroundColor: "{colors.alarm}"
    textColor: "{colors.alarm}"
    rounded: "{rounded.lg}"
    height: "2rem"
  badge-default:
    backgroundColor: "{colors.tally-amber}"
    textColor: "{colors.tally-amber-ink}"
    rounded: "{rounded.pill}"
    height: "1.25rem"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "1.25rem"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "0.75rem"
    padding: "1rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
---

# Design System: interview.ai

## 1. Overview

**Creative North Star: "On Air"**

interview.ai is styled as a broadcast/recording studio, not a SaaS dashboard. The candidate is stepping into a booth for a live take: a tally light indicates who's speaking, a signal chain of instrument panels carries the interview's stages, and a stage spotlight drifts quietly across the page. This is a deliberate departure from the generic AI-product template — no purple-to-blue gradient hero, no chat-bubble message UI with circular avatars, no Inter-as-default-sans, no rounded-everything card grid repeated as the answer to every layout question. Warm graphite stands in for stark near-black; one committed amber signal accent stands in for a multi-color gradient; an editorial serif carries headings instead of the safe sans-everywhere look every AI tool defaults to.

The system is built dark-first and ships dark-only today (the light theme below is fully specified in code but not yet wired to a toggle) — the studio is dim, the panels are lit, and the one warm accent reads as a signal in the dark, not decoration. Depth comes from light, not elevation: surfaces stay flat and bordered at rest, and a soft ambient glow — never a drop shadow — marks the one thing on a screen that matters most.

**Key Characteristics:**
- One committed accent (Tally Amber) used sparingly and consistently — for the primary action, the active/live state, and score/data visualization, never as decoration
- Editorial serif for headings and card titles, a clean grotesque for body and UI text, monospace for every label, timer, and score — three fonts, three distinct jobs, never mixed
- Flat panels with a subtle inset top highlight at rest; a soft amber glow is the only elevation signal, reserved for emphasis
- Mono-cased, letter-spaced micro-labels (`QUESTION`, `TRANSCRIPT SO FAR`, `ON AIR`) function as the studio's signage system — a consistent, restrained cadence, not a decorative eyebrow bolted onto every section
- Ambient atmosphere (film grain, a soft vignette, a pointer-following spotlight) runs globally under every page at very low opacity — present, not intrusive, and fully suppressed under reduced motion

## 2. Colors

Warm, dim, and restrained — one hue family carries almost the entire palette, with a single amber accent doing all the signaling.

### Primary
- **Tally Amber** (`oklch(0.75 0.14 60)`): The one accent color in the system. Primary buttons, focus rings, active tile borders, the on-air tally-light dot, score gauges and progress fills, links. Named for the literal broadcast tally light already built into the UI (`.studio-tally`). Never used as a background wash — always as a small, deliberate signal.
- **Tally Amber Ink** (`oklch(0.18 0.03 50)`): Text color on top of Tally Amber fills (primary button labels).

### Neutral
- **Studio Graphite** (`oklch(0.17 0.017 55)`): Page background. A warm near-black, not a pure gray or blue-black — the chroma is tiny (0.017) but present, tinted toward the same hue family as the amber accent so the whole palette reads as one system.
- **Panel** (`oklch(0.225 0.02 55)`): Card and popover surface, one step lighter than the page background — the "instrument panel" surface.
- **Slate Panel** (`oklch(0.27 0.022 55)`): Secondary surface — badges, muted backgrounds, the recessed track behind a progress bar.
- **Ink** (`oklch(0.94 0.015 75)`): Primary text. An off-white, not pure white — warm-tinted to match the rest of the palette.
- **Ink Muted** (`oklch(0.68 0.03 65)`): Secondary text — labels, metadata, timestamps, placeholder text.
- **Hairline** (`oklch(0.94 0.015 75 / 10%)`): Borders and dividers — a translucent slice of the ink color, not a separate gray, so borders always read as "a faint edge of the text color" rather than a foreign gray.

### Semantic
- **Alarm** (`oklch(0.62 0.16 30)`): The only other saturated color in the system, reserved strictly for destructive actions and failure states (end/cancel a session, a failed report, mic access denied). Used at low background opacity (`/10`, `/20`) with full-strength text, never as a solid fill except on a confirm button.

### Named Rules
**The One Signal Rule.** Tally Amber is the only accent in the system. If a second saturated color shows up anywhere outside Alarm's destructive-only role, that's drift — even the chart-role tokens (`chart-1` through `chart-5`) are tonal steps of the same amber hue, not a rainbow palette.

**The Warm Hairline Rule.** Never introduce a plain gray border. Every border and divider derives from the Ink color at low opacity, keeping every neutral in the system tinted toward the same warm hue rather than drifting cool.

## 3. Typography

**Display Font:** Source Serif 4 (with Georgia, serif fallback)
**Body Font:** Geist (with system-ui, sans-serif fallback)
**Label/Mono Font:** Geist Mono (with ui-monospace, monospace fallback)

**Character:** An editorial serif carries every heading and card title — measured, confident, unhurried, the opposite of a SaaS product's all-sans hierarchy. Geist Sans handles body copy and interactive UI text where legibility at small sizes matters most. Geist Mono is reserved entirely for the studio's signage system: micro-labels, timers, scores, and anything tabular — its presence is what makes a countdown or a score feel like an instrument reading rather than a rendered number.

### Hierarchy
- **Display** (500 weight, `text-4xl` to `text-6xl` fluid, 1.06–1.1 line-height): Landing-page hero headlines only. Serif, occasionally italicized for a single emphasized word (`<em class="italic">`).
- **Headline** (500 weight, `text-2xl`–`text-3xl`, 1.1 line-height): Page-level h1/h2 (dashboard welcome, section headers).
- **Title** (500 weight, 1rem, 1.375 line-height): Card titles (`font-heading`, serif) — every `CardTitle` in the system, from a stat panel to a dialog.
- **Body** (400 weight, 0.875rem, 1.5 line-height): Default UI text, descriptions, paragraph content. Cap prose at ~65–75ch where it appears in longer form (report summaries, roadmap notes).
- **Label** (500 weight, 0.68rem, 0.12em letter-spacing, uppercase, mono): Section-level micro-labels — `QUESTION`, `TRANSCRIPT SO FAR`, status badges, section eyebrows.
- **Label Small** (500 weight, 0.62rem, 0.05em letter-spacing, uppercase, mono): The same signage voice at one step down — speaker labels inside a transcript entry, tile name tags, timestamps — anywhere a label sits directly next to its own content rather than heading a whole section.

### Named Rules
**The Three-Job Rule.** Serif is for headings and titles only. Sans is for body and interactive text only. Mono is for labels, timers, and numbers only. A serif button label or a sans section header is drift, not a stylistic variant.

## 4. Elevation

Flat by default; light, not lift, is the depth cue. There are no drop shadows anywhere in the system — every resting surface is a flat panel with a single hairline border and a barely-visible inset highlight along its top edge (`box-shadow: 0 1px 0 0 color-mix(foreground 4%, transparent) inset`), simulating a studio light grazing the top of an instrument panel rather than a shadow implying the panel floats above the page.

Emphasis is conveyed with a soft ambient glow instead of elevation: `studio-glow` combines a barely-visible 1px outline with a diffuse amber blur (`0 0 24px -8px var(--primary)`), used sparingly on the one thing that matters most on a given screen — the primary CTA, the currently active/speaking tile, a highlighted result card. It is never applied to more than one or two elements per screen.

### Shadow Vocabulary
- **Panel highlight** (`box-shadow: 0 1px 0 0 color-mix(in srgb, var(--foreground) 4%, transparent) inset`): The resting state for every card and panel — `studio-panel`. Simulates a top-lit surface, not elevation.
- **Signal glow** (`box-shadow: 0 0 0 1px color-mix(in srgb, var(--foreground) 8%, transparent), 0 0 24px -8px var(--primary)`): The one emphasis tool in the system — `studio-glow`. Reserved for the primary action or the single most important element in view.
- **Critical pulse** (`animation: studio-pulse-critical 1.8s ease-out infinite`, radiating from a destructive-colored ring): The only elevation-adjacent motion effect, reserved for a countdown inside its final 60 seconds — urgency, not decoration.

### Named Rules
**The No-Shadow Rule.** If an element needs a drop shadow to read as "above" the page, the answer is a border and a panel background, not a shadow. The one exception is the tile frame's own resting shadow (`0 14px 34px -22px rgba(0,0,0,0.4)`), which exists to separate a video-call tile from the panel behind it, not to imply general elevation.

## 5. Components

Every component reads as an instrument-panel control: precise borders, minimal ornament, restrained motion. Nothing is playful or bouncy — states change with quick, confident transitions, never a spring or an overshoot.

### Buttons
- **Shape:** `rounded-lg` (6px, `{rounded.lg}`), height 2rem (32px) at default size, 1.75rem at `sm`, 2.25rem at `lg`.
- **Primary:** Tally Amber background, Tally Amber Ink text, `hover:bg-primary/80`. The one button style that should draw the eye on any given screen.
- **Secondary:** Slate Panel background, Ink text — a neutral, still-solid alternative when a screen has more than one actionable button.
- **Outline:** Transparent background, hairline border, `hover:bg-muted`. The default choice for a dismissive or secondary action next to a primary one.
- **Ghost:** No border, no fill at rest, `hover:bg-muted` on interaction only. Used for the lowest-emphasis actions (a "keep going" dismiss, a back link styled as a button).
- **Destructive:** Alarm background at 10% opacity, full-strength Alarm text — never a solid red fill except inside a confirmation dialog's final commit button.
- **All variants:** `cursor-pointer` at rest, `disabled:cursor-not-allowed` + 50% opacity when disabled, a 3px focus ring in Tally Amber at 50% opacity on keyboard focus, and a 1px downward translate on active/press — the one "physical" touch in an otherwise flat system.

### Badges
- **Shape:** Fully rounded (`{rounded.pill}`), height 1.25rem, `text-xs font-medium`.
- **Default:** Tally Amber fill — reserved for the rare case a badge itself needs to be the accent (e.g. an active/live state).
- **Secondary:** Slate Panel fill, Ink text — the default choice for metadata badges (interview type, difficulty, counts).
- **Outline:** Transparent with a hairline border — used for lower-emphasis tags or a "coming soon" marker.
- **Destructive:** Same treatment as the destructive button — Alarm at low opacity, full-strength text.

### Cards / Panels
- **Corner style:** `rounded-xl` (0.75rem) for the outer Card primitive; individual studio panels typically use `rounded-md` (0.375rem) for a tighter, more instrument-like feel.
- **Background:** Panel color, with a `ring-1 ring-foreground/10` hairline outline.
- **Shadow strategy:** Flat at rest (see Elevation); `studio-glow` applied only when the card is the primary focus of its screen.
- **Internal padding:** 1rem default (`--card-spacing`), 0.75rem for compact/`sm`-sized cards.
- **Never nest cards.** A card containing another bordered card-like box is a violation of the flat-panel language — use dividers (`divide-y divide-border`) inside a single panel instead.

### Inputs / Fields
- **Style:** Transparent background, hairline border (`border-input`), `rounded-lg`, height 2rem.
- **Focus:** Border shifts to Tally Amber (`focus-visible:border-ring`) plus a 3px amber ring at 50% opacity — no glow, no scale change.
- **Disabled:** 50% opacity, `cursor-not-allowed`, a faint tinted background fill.
- **Error (aria-invalid):** Border and ring shift to Alarm at reduced opacity.

### Studio Tiles (signature component)
The interviewer/candidate video-call tiles are the system's signature custom component: a fixed-aspect (4:3) framed panel, hairline border at rest, Tally Amber border + inset ring glow when that tile is the active speaker, a small pill label bottom-left carrying a live status dot (`studio-tally` when active, a flat muted dot otherwise). Both tiles in a session always share identical chrome — sizing, border, shadow — so the two peers never look asymmetric.

### Micro-labels (signature pattern)
The mono, uppercase, letter-spaced micro-label (Label at 0.68rem for section-level headers, Label Small at 0.62rem for in-context tags) is the studio's signage system: section headers ("Transcript so far", "Your progress"), live-state indicators ("On air" / "Listening" / "Thinking"), speaker labels in a transcript, timestamps. It is the one place in the system uppercase and heavy tracking are permitted — never on body text, never on a button label, never repeated as a decorative eyebrow above every section purely by reflex.

## 6. Do's and Don'ts

### Do:
- **Do** use Tally Amber (`oklch(0.75 0.14 60)`) as the only accent color in the system — for the primary action, the active/live state, and score visualization.
- **Do** keep every neutral (background, panel, border) tinted toward the same warm hue family as the amber accent — a pure, untinted gray is a foreign note in this palette.
- **Do** use the flat-panel-plus-glow elevation model: a hairline border and inset top highlight at rest, a soft amber glow only on the single most important element in view.
- **Do** reserve the mono, uppercase, letter-spaced label style for the studio's signage system (section labels, live-state indicators, timestamps) — consistently, not as a one-off decorative flourish.
- **Do** give the interviewer and candidate tiles identical chrome (size, border, shadow) so the active-speaker swap is the only visual difference between them.

### Don't:
- **Don't** use a purple-to-blue gradient hero, a chat-bubble message UI with circular avatars, or any other piece of the generic 2025–2026 AI-product template — this system exists specifically to not look like an anonymous AI chatbot wrapper.
- **Don't** default to Inter, Space Grotesk, or another "safe" sans as a display font — headings are always the editorial serif (Source Serif 4).
- **Don't** use a `border-left` or `border-right` greater than 1px as a colored accent stripe on a card, list item, or transcript entry. This reads as an AI-generated-UI tell; use a full border, a background tint, or a proper label instead.
- **Don't** use a drop shadow to imply elevation anywhere in the system. If something needs to read as "above" the page, use a border and the Panel background color, not a shadow.
- **Don't** nest a bordered card-like box inside another Card — use a divider (`divide-y divide-border`) inside one panel instead.
- **Don't** introduce a second saturated accent color outside of Alarm's destructive-only role, even for a chart or a data visualization — the chart tokens are tonal steps of the amber hue, not a multi-color palette.
- **Don't** apply `studio-glow` to more than one or two elements on a single screen — its whole effect depends on scarcity.
