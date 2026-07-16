/** Shared fetch helper for all job-source adapters. */

const DEFAULT_TIMEOUT_MS = 12_000;

/** One hour — matches the refresh cadence in job.lld.md. */
export const SOURCE_REVALIDATE_SECONDS = 3600;

export class SourceHttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`${status} from ${url}`);
    this.name = "SourceHttpError";
  }
}

/**
 * Fetches JSON with a timeout and Next data-cache revalidation, so each
 * upstream board is hit at most once per hour regardless of request volume.
 * Returns null on 404 (unknown board token) so callers can skip quietly.
 */
export async function fetchSourceJson<T>(
  url: string,
  init?: { headers?: Record<string, string> },
): Promise<T | null> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "ai-interviewer-app job aggregator (contact: admin)",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    next: { revalidate: SOURCE_REVALIDATE_SECONDS },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new SourceHttpError(url, res.status);
  return (await res.json()) as T;
}
