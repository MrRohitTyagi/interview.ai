import { normalizeForMatch, toAnnualUsd } from "./normalize";
import type {
  FacetCount,
  JobFacets,
  JobFilters,
  JobPosting,
} from "./types";

type FilterDimension = "employmentTypes" | "seniorities" | "sources" | "tags";

function matchesQuery(job: JobPosting, query: string): boolean {
  const q = normalizeForMatch(query);
  return (
    normalizeForMatch(job.title).includes(q) ||
    normalizeForMatch(job.descriptionText).includes(q)
  );
}

function salaryMeets(job: JobPosting, minUsd: number): boolean {
  if (!job.salary) return false;
  const best = toAnnualUsd(
    job.salary.max ?? job.salary.min,
    job.salary.currency,
    job.salary.period,
  );
  return best !== undefined && best >= minUsd;
}

/**
 * AND semantics across filter categories; OR within a multi-select.
 * `exclude` skips one dimension — used for facet counts so each facet shows
 * what the results would be if only that dimension were unconstrained.
 */
function matchesFilters(
  job: JobPosting,
  filters: JobFilters,
  exclude?: FilterDimension,
): boolean {
  if (filters.query && !matchesQuery(job, filters.query)) return false;

  if (filters.location) {
    const loc = normalizeForMatch(filters.location);
    if (!normalizeForMatch(job.location.raw).includes(loc)) return false;
  }

  // Remote-only is a distinct flag, never conflated with "no location given".
  if (filters.remoteOnly && !job.location.isRemote) return false;

  if (
    exclude !== "employmentTypes" &&
    filters.employmentTypes?.length &&
    !filters.employmentTypes.includes(job.employmentType)
  ) {
    return false;
  }

  if (
    exclude !== "seniorities" &&
    filters.seniorities?.length &&
    !filters.seniorities.includes(job.seniority)
  ) {
    return false;
  }

  if (filters.salaryMin !== undefined && !salaryMeets(job, filters.salaryMin)) {
    return false;
  }

  if (filters.postedWithinDays !== undefined) {
    const cutoff = Date.now() - filters.postedWithinDays * 24 * 60 * 60 * 1000;
    if (new Date(job.postedAt).getTime() < cutoff) return false;
  }

  if (filters.company) {
    if (!normalizeForMatch(job.company).includes(normalizeForMatch(filters.company))) {
      return false;
    }
  }

  if (
    exclude !== "sources" &&
    filters.sources?.length &&
    !filters.sources.includes(job.source)
  ) {
    return false;
  }

  if (exclude !== "tags" && filters.tags?.length) {
    const jobTags = new Set(job.tags.map(normalizeForMatch));
    if (!filters.tags.some((t) => jobTags.has(normalizeForMatch(t)))) return false;
  }

  return true;
}

function countBy(
  jobs: JobPosting[],
  pick: (job: JobPosting) => string[],
  limit?: number,
): FacetCount[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const value of pick(job)) {
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
  return limit ? sorted.slice(0, limit) : sorted;
}

export function computeFacets(jobs: JobPosting[], filters: JobFilters): JobFacets {
  const forDimension = (dim: FilterDimension) =>
    jobs.filter((j) => matchesFilters(j, filters, dim));

  return {
    employmentTypes: countBy(forDimension("employmentTypes"), (j) => [j.employmentType]),
    seniorities: countBy(forDimension("seniorities"), (j) => [j.seniority]),
    sources: countBy(forDimension("sources"), (j) => [j.source]),
    tags: countBy(forDimension("tags"), (j) => j.tags, 30),
  };
}

export function filterJobs(jobs: JobPosting[], filters: JobFilters): JobPosting[] {
  return jobs.filter((j) => matchesFilters(j, filters));
}
