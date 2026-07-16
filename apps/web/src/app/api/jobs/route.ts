import { NextResponse } from "next/server";

import { aggregateJobs } from "@/lib/jobs/aggregate";
import { computeFacets, filterJobs } from "@/lib/jobs/search";
import {
  ALL_SOURCES,
  type EmploymentType,
  type JobFilters,
  type JobSearchResult,
  type JobSource,
  type Seniority,
} from "@/lib/jobs/types";

const PAGE_SIZE = 20;

const EMPLOYMENT_TYPES: EmploymentType[] = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
  "unknown",
];
const SENIORITIES: Seniority[] = ["entry", "mid", "senior", "staff", "unknown"];

function csvParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T[] | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is T => (allowed as readonly string[]).includes(v));
  return values.length ? values : undefined;
}

function numberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const filters: JobFilters = {
    query: params.get("query")?.trim() || undefined,
    location: params.get("location")?.trim() || undefined,
    remoteOnly: params.get("remote") === "1",
    employmentTypes: csvParam(params, "types", EMPLOYMENT_TYPES),
    seniorities: csvParam(params, "seniority", SENIORITIES),
    salaryMin: numberParam(params, "salaryMin"),
    postedWithinDays: numberParam(params, "postedWithin"),
    company: params.get("company")?.trim() || undefined,
    sources: csvParam(params, "sources", ALL_SOURCES) as JobSource[] | undefined,
    tags: params.get("tags")?.split(",").map((t) => t.trim()).filter(Boolean),
  };
  if (!filters.tags?.length) filters.tags = undefined;

  const page = Math.max(1, Math.trunc(numberParam(params, "page") ?? 1));

  try {
    const { jobs, sources, fetchedAt } = await aggregateJobs();
    const filtered = filterJobs(jobs, filters);
    const facets = computeFacets(jobs, filters);
    const start = (page - 1) * PAGE_SIZE;

    const body: JobSearchResult = {
      jobs: filtered.slice(start, start + PAGE_SIZE),
      total: filtered.length,
      page,
      pageSize: PAGE_SIZE,
      facets,
      sources,
      fetchedAt,
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[jobs] aggregation failed", err);
    return NextResponse.json({ error: "Job search is temporarily unavailable." }, { status: 502 });
  }
}
