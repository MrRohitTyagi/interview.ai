import { ADAPTERS } from "./adapters";
import { dedupeJobs } from "./dedupe";
import type { JobPosting, JobSource, SourceStatus } from "./types";

/**
 * Per-source circuit breaker + last-good cache. Module-level state: in a
 * serverless deployment this is per-instance, which is acceptable — the
 * Next data cache underneath (1h revalidate on every upstream fetch) is the
 * real cross-request cache; this layer only adds failure memory.
 */
interface SourceState {
  lastGood?: { jobs: JobPosting[]; fetchedAt: number };
  consecutiveFailures: number;
  openUntil: number; // circuit open (skip fetching) until this timestamp
  lastError?: string;
}

const FAILURES_TO_OPEN = 3;
const CIRCUIT_OPEN_MS = 15 * 60 * 1000;
const AGGREGATE_MEMO_MS = 5 * 60 * 1000;

const sourceStates = new Map<JobSource, SourceState>();

function stateFor(source: JobSource): SourceState {
  let s = sourceStates.get(source);
  if (!s) {
    s = { consecutiveFailures: 0, openUntil: 0 };
    sourceStates.set(source, s);
  }
  return s;
}

export interface AggregateResult {
  jobs: JobPosting[];
  sources: SourceStatus[];
  fetchedAt: string;
}

let memo: { result: AggregateResult; at: number } | null = null;

async function fetchSource(
  adapter: (typeof ADAPTERS)[number],
): Promise<{ jobs: JobPosting[]; status: SourceStatus }> {
  const state = stateFor(adapter.source);

  if (!adapter.enabled()) {
    return {
      jobs: [],
      status: { source: adapter.source, status: "disabled", stale: false, jobCount: 0 },
    };
  }

  const staleFallback = (error?: string): { jobs: JobPosting[]; status: SourceStatus } => ({
    jobs: state.lastGood?.jobs ?? [],
    status: {
      source: adapter.source,
      status: "degraded",
      stale: Boolean(state.lastGood),
      jobCount: state.lastGood?.jobs.length ?? 0,
      error,
    },
  });

  if (Date.now() < state.openUntil) {
    return staleFallback(state.lastError ?? "circuit open");
  }

  try {
    // Sources can emit the same tag twice on one job (e.g. team and
    // department both "Sales") — dedupe here so every adapter is covered.
    const jobs = (await adapter.fetchJobs()).map((j) => ({
      ...j,
      tags: Array.from(new Set(j.tags)),
    }));
    state.consecutiveFailures = 0;
    state.lastError = undefined;
    state.lastGood = { jobs, fetchedAt: Date.now() };
    return {
      jobs,
      status: { source: adapter.source, status: "ok", stale: false, jobCount: jobs.length },
    };
  } catch (err) {
    state.consecutiveFailures += 1;
    state.lastError = err instanceof Error ? err.message : String(err);
    if (state.consecutiveFailures >= FAILURES_TO_OPEN) {
      state.openUntil = Date.now() + CIRCUIT_OPEN_MS;
    }
    return staleFallback(state.lastError);
  }
}

/**
 * Fetches every enabled source in parallel with full failure isolation:
 * one broken adapter never takes down the refresh, and an unreachable
 * source serves its last known-good jobs marked stale instead of vanishing.
 */
export async function aggregateJobs(): Promise<AggregateResult> {
  if (memo && Date.now() - memo.at < AGGREGATE_MEMO_MS) return memo.result;

  const settled = await Promise.allSettled(ADAPTERS.map((a) => fetchSource(a)));

  const allJobs: JobPosting[] = [];
  const sources: SourceStatus[] = [];
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") {
      allJobs.push(...res.value.jobs);
      sources.push(res.value.status);
    } else {
      // fetchSource itself catches — this is a belt-and-braces path.
      sources.push({
        source: ADAPTERS[i].source,
        status: "degraded",
        stale: false,
        jobCount: 0,
        error: String(res.reason),
      });
    }
  });

  const jobs = dedupeJobs(allJobs).sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  );

  const result: AggregateResult = {
    jobs,
    sources,
    fetchedAt: new Date().toISOString(),
  };
  memo = { result, at: Date.now() };
  return result;
}
