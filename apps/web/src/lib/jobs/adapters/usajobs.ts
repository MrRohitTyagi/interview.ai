import { fetchSourceJson } from "../http";
import { inferSeniorityFromTitle, toIso } from "../normalize";
import type { EmploymentType, JobPosting, SourceAdapter } from "../types";

interface UsaJobsRemuneration {
  MinimumRange?: string;
  MaximumRange?: string;
  RateIntervalCode?: string; // "PA" (per annum) | "PH" (per hour)
}

interface UsaJobsDescriptor {
  PositionID: string;
  PositionTitle: string;
  OrganizationName?: string;
  PositionLocationDisplay?: string;
  PositionURI?: string;
  PublicationStartDate?: string;
  PositionRemuneration?: UsaJobsRemuneration[];
  PositionSchedule?: { Name?: string }[];
  UserArea?: { Details?: { JobSummary?: string } };
}

interface UsaJobsResponse {
  SearchResult?: {
    SearchResultItems?: { MatchedObjectDescriptor: UsaJobsDescriptor }[];
  };
}

function scheduleToEmploymentType(d: UsaJobsDescriptor): EmploymentType {
  const name = d.PositionSchedule?.[0]?.Name?.toLowerCase() ?? "";
  if (name.includes("full")) return "full_time";
  if (name.includes("part")) return "part_time";
  return "unknown";
}

export const usajobsAdapter: SourceAdapter = {
  source: "usajobs",
  enabled: () => Boolean(process.env.USAJOBS_API_KEY),
  async fetchJobs(): Promise<JobPosting[]> {
    const data = await fetchSourceJson<UsaJobsResponse>(
      "https://data.usajobs.gov/api/search?ResultsPerPage=100",
      {
        headers: {
          "Authorization-Key": process.env.USAJOBS_API_KEY!,
          "User-Agent": process.env.USAJOBS_USER_AGENT ?? "job-aggregator",
          Host: "data.usajobs.gov",
        },
      },
    );
    const items = data?.SearchResult?.SearchResultItems ?? [];
    return items.map(({ MatchedObjectDescriptor: d }) => {
      const rem = d.PositionRemuneration?.[0];
      const min = rem?.MinimumRange ? Number(rem.MinimumRange) : undefined;
      const max = rem?.MaximumRange ? Number(rem.MaximumRange) : undefined;
      const locationRaw = d.PositionLocationDisplay ?? "";
      return {
        id: `usajobs:${d.PositionID}`,
        sourceId: d.PositionID,
        source: "usajobs" as const,
        company: d.OrganizationName ?? "US Federal Government",
        title: d.PositionTitle,
        descriptionHtml: "",
        descriptionText: d.UserArea?.Details?.JobSummary ?? "",
        location: {
          raw: locationRaw,
          country: "US",
          isRemote: /remote/i.test(locationRaw),
        },
        employmentType: scheduleToEmploymentType(d),
        seniority: inferSeniorityFromTitle(d.PositionTitle),
        seniorityInferred: true,
        salary:
          min && min > 0
            ? {
                min,
                max,
                currency: "USD",
                period: rem?.RateIntervalCode === "PH" ? ("hour" as const) : ("year" as const),
              }
            : null,
        tags: [],
        postedAt: toIso(d.PublicationStartDate),
        applyUrl: d.PositionURI ?? "",
      };
    });
  },
};
