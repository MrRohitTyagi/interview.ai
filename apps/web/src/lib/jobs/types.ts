// Unified shape every job source is normalized into before search,
// filtering, or dedup touch the data. See job.lld.md.

export const DIRECT_ATS_SOURCES = [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "recruitee",
] as const;

export const AGGREGATOR_SOURCES = [
  "arbeitnow",
  "remoteok",
  "remotive",
  "jobicy",
  "himalayas",
  "adzuna",
  "usajobs",
] as const;

export type JobSource =
  | (typeof DIRECT_ATS_SOURCES)[number]
  | (typeof AGGREGATOR_SOURCES)[number];

export const ALL_SOURCES: JobSource[] = [
  ...DIRECT_ATS_SOURCES,
  ...AGGREGATOR_SOURCES,
];

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "temporary"
  | "unknown";

export type Seniority = "entry" | "mid" | "senior" | "staff" | "unknown";

export interface JobSalary {
  min?: number;
  max?: number;
  currency?: string;
  period?: "year" | "hour";
}

export interface JobPosting {
  /** Stable internal id: `${source}:${sourceId}` */
  id: string;
  sourceId: string;
  source: JobSource;
  company: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  location: {
    raw: string;
    country?: string;
    isRemote: boolean;
  };
  employmentType: EmploymentType;
  seniority: Seniority;
  /** True when seniority was inferred from the title rather than provided by the source. */
  seniorityInferred: boolean;
  salary: JobSalary | null;
  tags: string[];
  /** ISO-8601 */
  postedAt: string;
  applyUrl: string;
}

export interface SourceStatus {
  source: JobSource;
  status: "ok" | "degraded" | "disabled";
  /** True when results are served from the last known-good fetch. */
  stale: boolean;
  jobCount: number;
  error?: string;
}

export interface SourceAdapter {
  source: JobSource;
  /** Adapters gated on env keys report themselves disabled instead of failing. */
  enabled: () => boolean;
  fetchJobs: () => Promise<JobPosting[]>;
}

/** Fixed conversion base — the salary filter UI takes ₹ and converts. */
export const INR_PER_USD = 97;

export interface JobFilters {
  query?: string;
  location?: string;
  remoteOnly?: boolean;
  employmentTypes?: EmploymentType[];
  seniorities?: Seniority[];
  /** Annual USD equivalents, converted at query time. */
  salaryMin?: number;
  postedWithinDays?: number;
  company?: string;
  sources?: JobSource[];
  tags?: string[];
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface JobFacets {
  employmentTypes: FacetCount[];
  seniorities: FacetCount[];
  sources: FacetCount[];
  tags: FacetCount[];
}

export interface JobSearchResult {
  jobs: JobPosting[];
  total: number;
  page: number;
  pageSize: number;
  facets: JobFacets;
  sources: SourceStatus[];
  fetchedAt: string;
}
