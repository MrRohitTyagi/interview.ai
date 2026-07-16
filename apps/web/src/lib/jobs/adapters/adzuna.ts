import { fetchSourceJson } from "../http";
import {
  inferSeniorityFromTitle,
  looksRemote,
  normalizeEmploymentType,
  toIso,
} from "../normalize";
import type { EmploymentType, JobPosting, SourceAdapter } from "../types";

interface AdzunaJob {
  id: string;
  title: string;
  description?: string; // plain text (already truncated by Adzuna)
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  created?: string; // ISO
  redirect_url: string;
  contract_type?: string; // "permanent" | "contract"
  contract_time?: string; // "full_time" | "part_time"
  category?: { label?: string };
}

interface AdzunaResponse {
  results: AdzunaJob[];
}

const COUNTRY_CURRENCY: Record<string, string> = {
  us: "USD",
  gb: "GBP",
  ca: "CAD",
  au: "AUD",
  de: "EUR",
  fr: "EUR",
  nl: "EUR",
  in: "INR",
};

function employmentTypeOf(j: AdzunaJob): EmploymentType {
  const time = normalizeEmploymentType(j.contract_time).employmentType;
  if (time !== "unknown") return time;
  return normalizeEmploymentType(j.contract_type).employmentType;
}

export const adzunaAdapter: SourceAdapter = {
  source: "adzuna",
  enabled: () => Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
  async fetchJobs(): Promise<JobPosting[]> {
    const appId = process.env.ADZUNA_APP_ID!;
    const appKey = process.env.ADZUNA_APP_KEY!;
    const countries = (process.env.ADZUNA_COUNTRIES ?? "us,gb")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    const jobs: JobPosting[] = [];
    for (const country of countries) {
      const data = await fetchSourceJson<AdzunaResponse>(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=50&content-type=application/json`,
      );
      if (!data?.results) continue;
      const currency = COUNTRY_CURRENCY[country];
      for (const j of data.results) {
        const locationRaw = j.location?.display_name ?? "";
        jobs.push({
          id: `adzuna:${j.id}`,
          sourceId: j.id,
          source: "adzuna",
          company: j.company?.display_name ?? "Unknown",
          title: j.title,
          descriptionHtml: "",
          descriptionText: j.description ?? "",
          location: {
            raw: locationRaw,
            country: country.toUpperCase(),
            isRemote: looksRemote(`${j.title} ${locationRaw}`),
          },
          employmentType: employmentTypeOf(j),
          seniority: inferSeniorityFromTitle(j.title),
          seniorityInferred: true,
          salary:
            j.salary_min && j.salary_min > 0
              ? { min: j.salary_min, max: j.salary_max, currency, period: "year" }
              : null,
          tags: j.category?.label ? [j.category.label] : [],
          postedAt: toIso(j.created),
          applyUrl: j.redirect_url,
        });
      }
    }
    return jobs;
  },
};
