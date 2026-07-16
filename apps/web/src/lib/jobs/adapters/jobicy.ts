import { fetchSourceJson } from "../http";
import {
  inferSeniorityFromTitle,
  normalizeEmploymentType,
  normalizeSeniority,
  stripHtml,
  toIso,
} from "../normalize";
import type { EmploymentType, JobPosting, SourceAdapter } from "../types";

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobGeo?: string;
  jobLevel?: string;
  jobType?: string[];
  pubDate?: string; // "2026-07-16 10:00:00" (UTC, no zone marker)
  jobDescription?: string; // HTML
  annualSalaryMin?: number;
  annualSalaryMax?: number;
  salaryCurrency?: string;
}

interface JobicyResponse {
  jobs: JobicyJob[];
}

function pickEmploymentType(types: string[] | undefined): {
  employmentType: EmploymentType;
  extraTags: string[];
} {
  for (const t of types ?? []) {
    const result = normalizeEmploymentType(t);
    if (result.employmentType !== "unknown") return result;
  }
  return { employmentType: "unknown", extraTags: [] };
}

export const jobicyAdapter: SourceAdapter = {
  source: "jobicy",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const data = await fetchSourceJson<JobicyResponse>(
      "https://jobicy.com/api/v2/remote-jobs",
    );
    if (!data?.jobs) return [];
    return data.jobs.map((j) => {
      const { employmentType, extraTags } = pickEmploymentType(j.jobType);
      const providedSeniority = normalizeSeniority(j.jobLevel);
      return {
        id: `jobicy:${j.id}`,
        sourceId: String(j.id),
        source: "jobicy" as const,
        company: j.companyName,
        title: j.jobTitle,
        descriptionHtml: j.jobDescription ?? "",
        descriptionText: stripHtml(j.jobDescription ?? ""),
        location: { raw: j.jobGeo ?? "Remote", isRemote: true },
        employmentType,
        seniority:
          providedSeniority !== "unknown"
            ? providedSeniority
            : inferSeniorityFromTitle(j.jobTitle),
        seniorityInferred: providedSeniority === "unknown",
        salary:
          j.annualSalaryMin && j.annualSalaryMin > 0
            ? {
                min: j.annualSalaryMin,
                max: j.annualSalaryMax,
                currency: j.salaryCurrency ?? "USD",
                period: "year" as const,
              }
            : null,
        tags: extraTags,
        // No zone marker on pubDate; Jobicy documents it as UTC.
        postedAt: toIso(j.pubDate ? `${j.pubDate.replace(" ", "T")}Z` : undefined),
        applyUrl: j.url,
      };
    });
  },
};
