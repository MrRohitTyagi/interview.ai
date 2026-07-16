import { ATS_BOARDS } from "@/data/job-boards";

import { fetchSourceJson } from "../http";
import {
  inferSeniorityFromTitle,
  looksRemote,
  normalizeEmploymentType,
  stripHtml,
  toIso,
} from "../normalize";
import type { JobPosting, SourceAdapter } from "../types";

interface LeverPosting {
  id: string;
  text: string;
  createdAt?: number; // epoch ms
  hostedUrl: string;
  description?: string; // HTML
  descriptionPlain?: string;
  workplaceType?: string; // "remote" | "hybrid" | "onsite" | "unspecified"
  categories?: {
    commitment?: string;
    location?: string;
    team?: string;
    department?: string;
  };
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    interval?: string; // e.g. "per-year-salary"
  };
}

function companyFromToken(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export const leverAdapter: SourceAdapter = {
  source: "lever",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const jobs: JobPosting[] = [];
    for (const token of ATS_BOARDS.lever) {
      const data = await fetchSourceJson<LeverPosting[]>(
        `https://api.lever.co/v0/postings/${token}?mode=json`,
      );
      if (!Array.isArray(data)) continue;
      for (const p of data) {
        const locationRaw = p.categories?.location ?? "";
        const { employmentType, extraTags } = normalizeEmploymentType(
          p.categories?.commitment,
        );
        const salaryInterval = p.salaryRange?.interval ?? "";
        jobs.push({
          id: `lever:${p.id}`,
          sourceId: p.id,
          source: "lever",
          company: companyFromToken(token),
          title: p.text,
          descriptionHtml: p.description ?? "",
          descriptionText: p.descriptionPlain ?? stripHtml(p.description ?? ""),
          location: {
            raw: locationRaw,
            isRemote: p.workplaceType === "remote" || looksRemote(locationRaw),
          },
          employmentType,
          seniority: inferSeniorityFromTitle(p.text),
          seniorityInferred: true,
          salary: p.salaryRange?.min
            ? {
                min: p.salaryRange.min,
                max: p.salaryRange.max,
                currency: p.salaryRange.currency,
                period: salaryInterval.includes("hour") ? "hour" : "year",
              }
            : null,
          tags: [
            ...[p.categories?.team, p.categories?.department].filter(
              (t): t is string => Boolean(t),
            ),
            ...extraTags,
          ],
          postedAt: toIso(p.createdAt),
          applyUrl: p.hostedUrl,
        });
      }
    }
    return jobs;
  },
};
