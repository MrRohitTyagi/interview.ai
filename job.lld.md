# Job Aggregator — Feature LLD

> Multi-source job aggregator with advanced filtering. Merges every free,
> ToS-compliant job data source into one search experience. No LinkedIn,
> Indeed, or scraping of platforms whose terms prohibit automated access.

---

## 1. Objective

Build a job ingestion and search service that pulls postings from multiple
free, legal sources, normalizes them into one internal shape, deduplicates
overlapping postings, and exposes an advanced filtered search API.

---

## 2. Scope / Non-goals

**In scope:** ingestion from public ATS and aggregator APIs, normalization,
deduplication, advanced search/filtering.

**Out of scope:**
- Scraping LinkedIn, Indeed, ZipRecruiter, or Glassdoor. Their ToS prohibits
  automated access, they run heavy anti-bot detection, and the legal exposure
  (breach of contract, not CFAA — see hiQ Labs v. LinkedIn) isn't worth it.
- Resume-to-job matching/recommendation. That's a separate downstream
  feature that would consume this data, not part of this one.

---

## 3. Legal grounding

- **hiQ Labs v. LinkedIn** (settled 2022) established that scraping publicly
  accessible data isn't a CFAA crime, but a site's Terms of Service can still
  create civil/contract liability for scraping it anyway.
- ATS job-board APIs below are *designed* to be public and callable — no
  login wall, no ToS violation, no anti-bot risk. This is the entire reason
  the feature is built on them instead of scraping job boards directly.

---

## 4. Data sources

### ATS job board APIs (structured, per-company, no auth)

- **Greenhouse** — public JSON endpoint per company board token, full JD
  available as HTML by requesting the content flag.
- **Lever** — public JSON endpoint per company, supports server-side
  filtering by team, location, commitment, and level.
- **Ashby** — public JSON endpoint per company, optional compensation data;
  no server-side filtering, so filtering happens after fetch.
- **SmartRecruiters** — public JSON endpoint per company, paginated.
- **Recruitee** — public JSON endpoint served from each company's own
  subdomain. Dates arrive in a non-ISO format and employment type arrives as
  a composite code (e.g. full-time + fixed-term bundled together) — both
  need explicit normalization, not a generic parser.

None of these has a directory endpoint listing "every company using this
ATS." A company → ATS mapping has to be built separately: either a seeded
static list of known company tokens, or auto-detection from a pasted
careers-page URL (Greenhouse/Lever/Ashby URLs are self-identifying by
domain), or both.

### Aggregator APIs (broad, multi-company)

- **Adzuna** — requires a free app id/key, generous free tier, strongest
  coverage in the UK/EU, 16 countries total.
- **USAJobs** — requires a free, self-service API key (no approval wait);
  US federal postings only.
- **Arbeitnow** — no auth, itself aggregates from ATS platforms, useful as a
  cross-check/fallback source.
- **RemoteOK, Remotive, Jobicy, Himalayas** — no auth, remote-only postings,
  smaller volume individually but easy to merge in.

---

## 5. Normalization principles

Every source has a different shape, different date formats, and different
missing fields. The implementation must normalize all of them into one
internal representation before anything else touches the data — search,
filtering, and deduplication all assume a single consistent shape.

Rules that matter in practice:
- Convert every non-ISO date format into ISO-8601 explicitly per source;
  don't rely on a generic date parser to guess correctly.
- Split composite fields (like Recruitee's bundled employment-type codes)
  into their real separate attributes.
- Where a source doesn't provide a field (salary, seniority, tags), leave it
  genuinely absent rather than guessing a value and presenting it as if the
  source provided it. Any value the system infers itself must be marked as
  inferred, not indistinguishable from source data.
- Strip HTML descriptions into plain text with a proper HTML-to-text parser
  for search indexing, not a regex strip.

---

## 6. Deduplication

The same role is frequently posted to more than one board — a company using
Lever directly, plus that same posting re-appearing through an aggregator
like Arbeitnow. Postings should be matched on company + title + location
(case-insensitive, whitespace-normalized) within a rolling window of about
30 days. When a duplicate is found, the record from the more authoritative
source (direct ATS over aggregator) is kept, and any fields missing from
the kept record are filled in from the duplicate before it's discarded.

---

## 7. Ingestion pipeline

- One adapter per source. A malformed or changed response from one source
  must never break ingestion for the others — failures are isolated per
  adapter, not global.
- Each source refreshes on its own cadence appropriate to its rate limits —
  direct ATS boards can be polled more frequently than aggregator APIs with
  stricter free-tier quotas, but never so frequently that a small company's
  board gets hammered.
- A posting not seen in the latest fetch is marked stale rather than deleted
  immediately — APIs occasionally omit records transiently, so hard deletion
  only happens after several consecutive misses.
- Raw source responses are worth retaining briefly alongside normalized
  records, purely to debug normalization bugs without needing to re-fetch.

---

## 8. Advanced filtering

The search layer needs to combine, at minimum:
- **Keyword** — full-text over title and description.
- **Location** — city/region/country, and a distinct "remote-only" flag
  that is not conflated with "location simply wasn't specified."
- **Employment type** — multi-select (full-time, part-time, contract,
  internship, temporary).
- **Seniority** — multi-select, with "unknown" as its own explicit,
  filterable bucket rather than those postings silently disappearing from
  results.
- **Salary range** — with currency normalized for display at query time
  using a live/periodic FX rate, not baked into storage.
- **Posted within** — recency windows (last day / week / month).
- **Company** — exact or partial match.
- **Source** — include/exclude specific origin APIs, useful both for
  debugging and for letting a user prefer verified ATS postings only.
- **Tags / tech stack** — multi-select, understanding that this will only be
  populated for sources that actually provide it and must degrade
  gracefully for the ones that don't.

Filters combine with AND semantics across categories; multiple selected
values within one filter (e.g. two employment types) combine with OR.
Results should include facet counts per filter value so a UI can show live
counts as filters are narrowed.

---

## 9. Error handling & resilience

- Each adapter carries its own circuit breaker: after repeated consecutive
  failures it stops polling and reports itself as degraded rather than
  retrying forever.
- A partial ingestion failure (some sources succeed, others don't) must
  still serve the sources that succeeded — one broken adapter should never
  take down the whole refresh.
- If a source is unreachable, search falls back to the last known-good
  cached data for that source (marked stale) instead of that source's
  postings silently vanishing from results.

---

## 10. Integration with the rest of the app

- **Paste-a-URL JD autofill** — given a job posting URL, detect which ATS it
  belongs to from the domain pattern and fetch the structured JD directly,
  instead of requiring the candidate to copy-paste text.
- **Company persona seeding** — the aggregated company list can back the
  existing "Company Personas" roadmap item with real, currently-hiring
  companies instead of static data.

---

## 11. Acceptance criteria

- Every source above has its own independently testable adapter.
- A single query combining at least four filter types at once (e.g.
  keyword + location + salary + posted-within) returns correct, deduplicated
  results.
- Disabling or breaking one adapter does not prevent results from the
  others.
- No code path calls a ToS-prohibited endpoint (LinkedIn, Indeed, etc.).
- Recruitee's non-ISO dates and composite employment-type codes are
  correctly normalized — treated as an explicit test case, not an
  afterthought.
- Duplicate postings (same company/title/location from two sources within
  the dedup window) collapse into a single result.
