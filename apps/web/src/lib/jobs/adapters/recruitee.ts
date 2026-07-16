import { ATS_BOARDS } from "@/data/job-boards";

import { fetchSourceJson } from "../http";
import {
  inferSeniorityFromTitle,
  looksRemote,
  normalizeEmploymentType,
  recruiteeDateToIso,
  stripHtml,
} from "../normalize";
import type { JobPosting, SourceAdapter } from "../types";

interface RecruiteeOffer {
  id: number;
  title: string;
  description?: string; // HTML
  location?: string;
  city?: string;
  country?: string;
  remote?: boolean;
  // Composite codes like "fulltime_fixed_term" — split during normalization.
  employment_type_code?: string;
  careers_url?: string;
  created_at?: string; // "2026-05-29 14:07:42 UTC" — NOT ISO-8601
  department?: string;
  tags?: string[];
}

interface RecruiteeResponse {
  offers: RecruiteeOffer[];
}

function companyFromToken(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export const recruiteeAdapter: SourceAdapter = {
  source: "recruitee",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const jobs: JobPosting[] = [];
    for (const token of ATS_BOARDS.recruitee) {
      const data = await fetchSourceJson<RecruiteeResponse>(
        `https://${token}.recruitee.com/api/offers/`,
      );
      if (!data?.offers) continue;
      for (const o of data.offers) {
        const locationRaw =
          o.location ?? [o.city, o.country].filter(Boolean).join(", ");
        const { employmentType, extraTags } = normalizeEmploymentType(
          o.employment_type_code,
        );
        jobs.push({
          id: `recruitee:${o.id}`,
          sourceId: String(o.id),
          source: "recruitee",
          company: companyFromToken(token),
          title: o.title,
          descriptionHtml: o.description ?? "",
          descriptionText: stripHtml(o.description ?? ""),
          location: {
            raw: locationRaw,
            country: o.country,
            isRemote: o.remote ?? looksRemote(locationRaw),
          },
          employmentType,
          seniority: inferSeniorityFromTitle(o.title),
          seniorityInferred: true,
          salary: null,
          tags: [
            ...(o.department ? [o.department] : []),
            ...(o.tags ?? []),
            ...extraTags,
          ],
          postedAt: recruiteeDateToIso(o.created_at ?? ""),
          applyUrl: o.careers_url ?? "",
        });
      }
    }
    return jobs;
  },
};
