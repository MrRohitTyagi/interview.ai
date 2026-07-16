import { fetchSourceJson } from "../http";
import {
  inferSeniorityFromTitle,
  normalizeEmploymentType,
  normalizeSeniority,
  stripHtml,
  toIso,
} from "../normalize";
import type { JobPosting, SourceAdapter } from "../types";

interface HimalayasJob {
  guid?: string;
  title?: string;
  companyName?: string;
  description?: string; // HTML
  excerpt?: string;
  applicationLink?: string;
  pubDate?: number; // epoch seconds
  locationRestrictions?: string[];
  categories?: string[];
  seniority?: string[];
  employmentType?: string;
}

interface HimalayasResponse {
  jobs: HimalayasJob[];
}

export const himalayasAdapter: SourceAdapter = {
  source: "himalayas",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const data = await fetchSourceJson<HimalayasResponse>(
      "https://himalayas.app/jobs/api",
    );
    if (!data?.jobs) return [];
    return data.jobs
      .filter((j) => j.title && j.companyName)
      .map((j) => {
        const { employmentType, extraTags } = normalizeEmploymentType(
          j.employmentType,
        );
        const providedSeniority = normalizeSeniority(j.seniority?.[0]);
        const locationRaw = j.locationRestrictions?.length
          ? j.locationRestrictions.join(", ")
          : "Remote";
        return {
          id: `himalayas:${j.guid ?? `${j.companyName}-${j.title}`}`,
          sourceId: j.guid ?? `${j.companyName}-${j.title}`,
          source: "himalayas" as const,
          company: j.companyName!,
          title: j.title!,
          descriptionHtml: j.description ?? "",
          descriptionText: stripHtml(j.description ?? j.excerpt ?? ""),
          location: { raw: locationRaw, isRemote: true },
          employmentType,
          seniority:
            providedSeniority !== "unknown"
              ? providedSeniority
              : inferSeniorityFromTitle(j.title!),
          seniorityInferred: providedSeniority === "unknown",
          salary: null,
          tags: [...(j.categories ?? []), ...extraTags],
          postedAt: toIso(j.pubDate),
          applyUrl: j.applicationLink ?? "",
        };
      });
  },
};
