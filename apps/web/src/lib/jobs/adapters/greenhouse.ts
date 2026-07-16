import { ATS_BOARDS } from "@/data/job-boards";

import { fetchSourceJson } from "../http";
import { inferSeniorityFromTitle, looksRemote, stripHtml, toIso } from "../normalize";
import type { JobPosting, SourceAdapter } from "../types";

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at?: string;
  first_published?: string;
  absolute_url: string;
  location?: { name?: string };
  // HTML-escaped HTML when ?content=true is passed.
  content?: string;
  departments?: { name?: string }[];
}

interface GreenhouseBoardResponse {
  jobs: GreenhouseJob[];
}

function unescapeHtml(escaped: string): string {
  return escaped
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function companyFromToken(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export const greenhouseAdapter: SourceAdapter = {
  source: "greenhouse",
  enabled: () => true,
  async fetchJobs(): Promise<JobPosting[]> {
    const jobs: JobPosting[] = [];
    for (const token of ATS_BOARDS.greenhouse) {
      const data = await fetchSourceJson<GreenhouseBoardResponse>(
        `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
      );
      if (!data?.jobs) continue;
      for (const j of data.jobs) {
        const html = j.content ? unescapeHtml(j.content) : "";
        const locationRaw = j.location?.name ?? "";
        jobs.push({
          id: `greenhouse:${j.id}`,
          sourceId: String(j.id),
          source: "greenhouse",
          company: companyFromToken(token),
          title: j.title,
          descriptionHtml: html,
          descriptionText: stripHtml(html),
          location: { raw: locationRaw, isRemote: looksRemote(locationRaw) },
          employmentType: "unknown",
          seniority: inferSeniorityFromTitle(j.title),
          seniorityInferred: true,
          salary: null,
          tags: (j.departments ?? [])
            .map((d) => d.name)
            .filter((n): n is string => Boolean(n)),
          postedAt: toIso(j.first_published ?? j.updated_at),
          applyUrl: j.absolute_url,
        });
      }
    }
    return jobs;
  },
};
