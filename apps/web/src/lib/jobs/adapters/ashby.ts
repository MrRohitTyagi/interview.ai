import { ATS_BOARDS } from "@/data/job-boards";

import { fetchSourceJson } from "../http";
import {
  inferSeniorityFromTitle,
  looksRemote,
  normalizeEmploymentType,
  stripHtml,
  toIso,
} from "../normalize";
import type { JobPosting, JobSalary, SourceAdapter } from "../types";

interface AshbySummaryComponent {
  compensationType?: string; // "Salary" | "EquityPercentage" | ...
  minValue?: number;
  maxValue?: number;
  currencyCode?: string;
  interval?: string; // e.g. "1 YEAR", "1 HOUR"
}

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  employmentType?: string; // "FullTime" | "PartTime" | "Intern" | "Contract" | "Temporary"
  isRemote?: boolean;
  publishedAt?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  jobUrl?: string;
  applyUrl?: string;
  department?: string;
  team?: string;
  compensation?: { summaryComponents?: AshbySummaryComponent[] };
}

interface AshbyBoardResponse {
  jobs: AshbyJob[];
}

function salaryFromCompensation(job: AshbyJob): JobSalary | null {
  const comp = job.compensation?.summaryComponents?.find(
    (c) => c.compensationType === "Salary" && (c.minValue || c.maxValue),
  );
  if (!comp) return null;
  return {
    min: comp.minValue,
    max: comp.maxValue,
    currency: comp.currencyCode,
    period: comp.interval?.toUpperCase().includes("HOUR") ? "hour" : "year",
  };
}

function companyFromToken(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export const ashbyAdapter: SourceAdapter = {
  source: "ashby",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const jobs: JobPosting[] = [];
    for (const token of ATS_BOARDS.ashby) {
      // No server-side filtering on this endpoint — everything is filtered
      // after fetch, per job.lld.md.
      const data = await fetchSourceJson<AshbyBoardResponse>(
        `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`,
      );
      if (!data?.jobs) continue;
      for (const j of data.jobs) {
        const locationRaw = j.location ?? "";
        const { employmentType, extraTags } = normalizeEmploymentType(j.employmentType);
        jobs.push({
          id: `ashby:${j.id}`,
          sourceId: j.id,
          source: "ashby",
          company: companyFromToken(token),
          title: j.title,
          descriptionHtml: j.descriptionHtml ?? "",
          descriptionText: j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? ""),
          location: {
            raw: locationRaw,
            isRemote: j.isRemote ?? looksRemote(locationRaw),
          },
          employmentType,
          seniority: inferSeniorityFromTitle(j.title),
          seniorityInferred: true,
          salary: salaryFromCompensation(j),
          tags: [
            ...[j.department, j.team].filter((t): t is string => Boolean(t)),
            ...extraTags,
          ],
          postedAt: toIso(j.publishedAt),
          applyUrl: j.jobUrl ?? j.applyUrl ?? "",
        });
      }
    }
    return jobs;
  },
};
