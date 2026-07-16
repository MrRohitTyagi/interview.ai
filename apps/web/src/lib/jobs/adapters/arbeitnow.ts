import { fetchSourceJson } from "../http";
import {
  inferSeniorityFromTitle,
  normalizeEmploymentType,
  stripHtml,
  toIso,
} from "../normalize";
import type { EmploymentType, JobPosting, SourceAdapter } from "../types";

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description?: string; // HTML
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number; // epoch seconds
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
}

function pickEmploymentType(jobTypes: string[] | undefined): {
  employmentType: EmploymentType;
  extraTags: string[];
} {
  for (const t of jobTypes ?? []) {
    const result = normalizeEmploymentType(t);
    if (result.employmentType !== "unknown") return result;
  }
  return { employmentType: "unknown", extraTags: [] };
}

export const arbeitnowAdapter: SourceAdapter = {
  source: "arbeitnow",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const data = await fetchSourceJson<ArbeitnowResponse>(
      "https://www.arbeitnow.com/api/job-board-api",
    );
    if (!data?.data) return [];
    return data.data.map((j) => {
      const { employmentType, extraTags } = pickEmploymentType(j.job_types);
      return {
        id: `arbeitnow:${j.slug}`,
        sourceId: j.slug,
        source: "arbeitnow" as const,
        company: j.company_name,
        title: j.title,
        descriptionHtml: j.description ?? "",
        descriptionText: stripHtml(j.description ?? ""),
        location: { raw: j.location ?? "", isRemote: j.remote ?? false },
        employmentType,
        seniority: inferSeniorityFromTitle(j.title),
        seniorityInferred: true,
        salary: null,
        tags: [...(j.tags ?? []), ...extraTags],
        postedAt: toIso(j.created_at),
        applyUrl: j.url,
      };
    });
  },
};
