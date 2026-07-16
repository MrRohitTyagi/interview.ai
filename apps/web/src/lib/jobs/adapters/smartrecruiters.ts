import { ATS_BOARDS } from "@/data/job-boards";

import { fetchSourceJson } from "../http";
import {
  inferSeniorityFromTitle,
  normalizeEmploymentType,
  normalizeSeniority,
  toIso,
} from "../normalize";
import type { JobPosting, SourceAdapter } from "../types";

interface SmartRecruitersPosting {
  id: string;
  name: string;
  releasedDate?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  typeOfEmployment?: { id?: string; label?: string };
  experienceLevel?: { id?: string; label?: string };
  company?: { name?: string; identifier?: string };
  department?: { label?: string };
  function?: { label?: string };
}

interface SmartRecruitersResponse {
  totalFound: number;
  content: SmartRecruitersPosting[];
}

const PAGE_LIMIT = 100;

export const smartrecruitersAdapter: SourceAdapter = {
  source: "smartrecruiters",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const jobs: JobPosting[] = [];
    for (const token of ATS_BOARDS.smartrecruiters) {
      // Paginated via limit/offset; the list endpoint has no descriptions —
      // that field degrades gracefully to empty rather than one fetch per job.
      let offset = 0;
      for (;;) {
        const data = await fetchSourceJson<SmartRecruitersResponse>(
          `https://api.smartrecruiters.com/v1/companies/${token}/postings?limit=${PAGE_LIMIT}&offset=${offset}`,
        );
        if (!data?.content?.length) break;
        for (const p of data.content) {
          const locationRaw = [p.location?.city, p.location?.region, p.location?.country]
            .filter(Boolean)
            .join(", ");
          const { employmentType, extraTags } = normalizeEmploymentType(
            p.typeOfEmployment?.label ?? p.typeOfEmployment?.id,
          );
          const providedSeniority = normalizeSeniority(p.experienceLevel?.id);
          jobs.push({
            id: `smartrecruiters:${p.id}`,
            sourceId: p.id,
            source: "smartrecruiters",
            company: p.company?.name ?? token,
            title: p.name,
            descriptionHtml: "",
            descriptionText: "",
            location: {
              raw: locationRaw,
              country: p.location?.country?.toUpperCase(),
              isRemote: p.location?.remote ?? false,
            },
            employmentType,
            seniority:
              providedSeniority !== "unknown"
                ? providedSeniority
                : inferSeniorityFromTitle(p.name),
            seniorityInferred: providedSeniority === "unknown",
            salary: null,
            tags: [
              ...[p.department?.label, p.function?.label].filter(
                (t): t is string => Boolean(t),
              ),
              ...extraTags,
            ],
            postedAt: toIso(p.releasedDate),
            applyUrl: `https://jobs.smartrecruiters.com/${p.company?.identifier ?? token}/${p.id}`,
          });
        }
        offset += PAGE_LIMIT;
        if (offset >= data.totalFound || offset >= 400) break; // cap per company
      }
    }
    return jobs;
  },
};
