import { normalizeForMatch } from "./normalize";
import { DIRECT_ATS_SOURCES, type JobPosting } from "./types";

const DEDUP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function dedupeKey(job: JobPosting): string {
  return [
    normalizeForMatch(job.company),
    normalizeForMatch(job.title),
    normalizeForMatch(job.location.raw),
  ].join("|");
}

function authorityRank(job: JobPosting): number {
  // Direct ATS beats aggregator re-posts of the same role.
  return (DIRECT_ATS_SOURCES as readonly string[]).includes(job.source) ? 0 : 1;
}

/** Fills fields the kept record is missing from the discarded duplicate. */
function mergeMissingFields(keep: JobPosting, other: JobPosting): JobPosting {
  return {
    ...keep,
    descriptionHtml: keep.descriptionHtml || other.descriptionHtml,
    descriptionText: keep.descriptionText || other.descriptionText,
    salary: keep.salary ?? other.salary,
    employmentType:
      keep.employmentType === "unknown" ? other.employmentType : keep.employmentType,
    seniority: keep.seniority === "unknown" ? other.seniority : keep.seniority,
    seniorityInferred:
      keep.seniority === "unknown" ? other.seniorityInferred : keep.seniorityInferred,
    tags: Array.from(new Set([...keep.tags, ...other.tags])),
  };
}

/**
 * Collapses the same role posted to multiple boards: matched on normalized
 * company + title + location within a rolling 30-day window, keeping the
 * more authoritative record and back-filling its missing fields.
 */
export function dedupeJobs(jobs: JobPosting[]): JobPosting[] {
  const byKey = new Map<string, JobPosting>();

  for (const job of jobs) {
    const key = dedupeKey(job);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, job);
      continue;
    }

    const gap = Math.abs(
      new Date(existing.postedAt).getTime() - new Date(job.postedAt).getTime(),
    );
    if (gap > DEDUP_WINDOW_MS) {
      // Same key but far apart in time — treat as a genuine re-post; keep the newer.
      if (new Date(job.postedAt) > new Date(existing.postedAt)) byKey.set(key, job);
      continue;
    }

    const [keep, drop] =
      authorityRank(job) < authorityRank(existing) ? [job, existing] : [existing, job];
    byKey.set(key, mergeMissingFields(keep, drop));
  }

  return Array.from(byKey.values());
}
