import { convert } from "html-to-text";

import { INR_PER_USD, type EmploymentType, type Seniority } from "./types";

/** Proper HTML → plain text for search indexing (not a regex strip). */
export function stripHtml(html: string): string {
  if (!html) return "";
  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
    ],
  })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Recruitee dates arrive as "2026-05-29 14:07:42 UTC" — not ISO-8601.
 * Converted explicitly rather than trusting a generic parser.
 */
export function recruiteeDateToIso(raw: string): string {
  const m = raw.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/);
  if (m) return `${m[1]}T${m[2]}Z`;
  return toIso(raw);
}

/** Best-effort conversion of anything date-like into ISO-8601. */
export function toIso(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") {
    return new Date(0).toISOString();
  }
  if (typeof value === "number") {
    // Heuristic: epoch seconds vs milliseconds.
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
  return parsed.toISOString();
}

const EMPLOYMENT_TYPE_MAP: Record<string, EmploymentType> = {
  fulltime: "full_time",
  full_time: "full_time",
  "full-time": "full_time",
  "full time": "full_time",
  permanent: "full_time",
  parttime: "part_time",
  part_time: "part_time",
  "part-time": "part_time",
  "part time": "part_time",
  contract: "contract",
  contractor: "contract",
  freelance: "contract",
  b2b: "contract",
  internship: "internship",
  intern: "internship",
  trainee: "internship",
  temporary: "temporary",
  temp: "temporary",
  seasonal: "temporary",
};

/**
 * Normalizes an employment-type string from any source. Handles Recruitee's
 * composite codes like "fulltime_fixed_term": the leading token is the real
 * employment type, the remainder (e.g. "fixed_term") is returned as an extra
 * tag instead of being silently dropped.
 */
export function normalizeEmploymentType(raw: string | undefined | null): {
  employmentType: EmploymentType;
  extraTags: string[];
} {
  if (!raw) return { employmentType: "unknown", extraTags: [] };
  const cleaned = raw.trim().toLowerCase();

  const direct = EMPLOYMENT_TYPE_MAP[cleaned];
  if (direct) return { employmentType: direct, extraTags: [] };

  // Composite codes: try progressively shorter leading segments.
  const parts = cleaned.split(/[_\s-]+/);
  for (let take = parts.length - 1; take >= 1; take--) {
    const head = parts.slice(0, take).join("_");
    const mapped = EMPLOYMENT_TYPE_MAP[head];
    if (mapped) {
      const rest = parts.slice(take).join("_");
      return { employmentType: mapped, extraTags: rest ? [rest] : [] };
    }
  }
  return { employmentType: "unknown", extraTags: [] };
}

const SENIORITY_MAP: Record<string, Seniority> = {
  entry: "entry",
  entry_level: "entry",
  junior: "entry",
  graduate: "entry",
  associate: "entry",
  internship: "entry",
  mid: "mid",
  mid_level: "mid",
  mid_senior_level: "mid",
  intermediate: "mid",
  senior: "senior",
  senior_level: "senior",
  lead: "staff",
  staff: "staff",
  principal: "staff",
  director: "staff",
  executive: "staff",
};

/** Maps a seniority value that a source explicitly provided. */
export function normalizeSeniority(raw: string | undefined | null): Seniority {
  if (!raw) return "unknown";
  return SENIORITY_MAP[raw.trim().toLowerCase().replace(/[\s-]+/g, "_")] ?? "unknown";
}

/**
 * Infers seniority from a job title when the source didn't provide one.
 * Callers must mark the result as inferred so it stays distinguishable from
 * source-provided data.
 */
export function inferSeniorityFromTitle(title: string): Seniority {
  const t = ` ${title.toLowerCase()} `;
  if (/\b(intern|internship|graduate|junior|jr\.?|entry[- ]level)\b/.test(t)) return "entry";
  if (/\b(staff|principal|lead|head of|director|vp)\b/.test(t)) return "staff";
  if (/\b(senior|sr\.?)\b/.test(t)) return "senior";
  return "unknown";
}

const REMOTE_RE = /\bremote\b|\bwork from home\b|\banywhere\b|\bdistributed\b/i;

export function looksRemote(locationRaw: string): boolean {
  return REMOTE_RE.test(locationRaw);
}

/**
 * Fixed FX table for query-time salary comparison only — display always keeps
 * the source currency. Rough rates; good enough for a filter threshold.
 */
const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.66,
  CHF: 1.12,
  INR: 1 / INR_PER_USD,
  PLN: 0.25,
  SEK: 0.095,
  DKK: 0.145,
  NOK: 0.093,
  JPY: 0.0067,
  SGD: 0.74,
  BRL: 0.18,
};

const HOURS_PER_YEAR = 2080;

/** Annual USD equivalent of a salary bound, or undefined if not computable. */
export function toAnnualUsd(
  amount: number | undefined,
  currency: string | undefined,
  period: "year" | "hour" | undefined,
): number | undefined {
  if (amount === undefined || amount <= 0) return undefined;
  const rate = FX_TO_USD[(currency ?? "USD").toUpperCase()];
  if (rate === undefined) return undefined;
  const annual = period === "hour" ? amount * HOURS_PER_YEAR : amount;
  return annual * rate;
}

/** Dedup/matching key: case-insensitive, whitespace-collapsed. */
export function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
