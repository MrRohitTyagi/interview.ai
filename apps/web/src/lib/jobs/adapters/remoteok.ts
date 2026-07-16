import { fetchSourceJson } from "../http";
import { inferSeniorityFromTitle, stripHtml, toIso } from "../normalize";
import type { JobPosting, SourceAdapter } from "../types";

interface RemoteOkJob {
  id?: string | number;
  company?: string;
  position?: string;
  description?: string; // HTML
  tags?: string[];
  location?: string;
  salary_min?: number;
  salary_max?: number;
  date?: string; // ISO
  url?: string;
  apply_url?: string;
}

export const remoteokAdapter: SourceAdapter = {
  source: "remoteok",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const data = await fetchSourceJson<RemoteOkJob[]>("https://remoteok.com/api");
    if (!Array.isArray(data)) return [];
    // The first array element is a legal/metadata notice, not a job —
    // filtering on required fields drops it and any malformed rows.
    return data
      .filter((j) => j.id && j.position && j.company)
      .map((j) => ({
        id: `remoteok:${j.id}`,
        sourceId: String(j.id),
        source: "remoteok" as const,
        company: j.company!,
        title: j.position!,
        descriptionHtml: j.description ?? "",
        descriptionText: stripHtml(j.description ?? ""),
        location: { raw: j.location ?? "Remote", isRemote: true },
        employmentType: "unknown" as const,
        seniority: inferSeniorityFromTitle(j.position!),
        seniorityInferred: true,
        salary:
          j.salary_min && j.salary_min > 0
            ? {
                min: j.salary_min,
                max: j.salary_max,
                currency: "USD",
                period: "year" as const,
              }
            : null,
        tags: j.tags ?? [],
        postedAt: toIso(j.date),
        applyUrl: j.apply_url ?? j.url ?? "",
      }));
  },
};
