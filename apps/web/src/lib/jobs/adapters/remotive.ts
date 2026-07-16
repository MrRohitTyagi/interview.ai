import { fetchSourceJson } from "../http";
import {
  inferSeniorityFromTitle,
  normalizeEmploymentType,
  stripHtml,
  toIso,
} from "../normalize";
import type { JobPosting, SourceAdapter } from "../types";

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  category?: string;
  tags?: string[];
  job_type?: string; // "full_time" | "contract" | ...
  publication_date?: string; // ISO
  candidate_required_location?: string;
  description?: string; // HTML
  url: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

export const remotiveAdapter: SourceAdapter = {
  source: "remotive",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const data = await fetchSourceJson<RemotiveResponse>(
      "https://remotive.com/api/remote-jobs",
    );
    if (!data?.jobs) return [];
    return data.jobs.map((j) => {
      const { employmentType, extraTags } = normalizeEmploymentType(j.job_type);
      return {
        id: `remotive:${j.id}`,
        sourceId: String(j.id),
        source: "remotive" as const,
        company: j.company_name,
        title: j.title,
        descriptionHtml: j.description ?? "",
        descriptionText: stripHtml(j.description ?? ""),
        // Remotive's `salary` is a freeform string — left absent rather than
        // guessed, per the normalization principles in job.lld.md.
        salary: null,
        location: {
          raw: j.candidate_required_location ?? "Remote",
          isRemote: true,
        },
        employmentType,
        seniority: inferSeniorityFromTitle(j.title),
        seniorityInferred: true,
        tags: [...(j.category ? [j.category] : []), ...(j.tags ?? []), ...extraTags],
        postedAt: toIso(j.publication_date),
        applyUrl: j.url,
      };
    });
  },
};
