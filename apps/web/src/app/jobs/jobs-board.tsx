"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Building2,
  Clock,
  Globe,
  Loader2,
  MapPin,
  Mic,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  INR_PER_USD,
  type EmploymentType,
  type JobPosting,
  type JobSearchResult,
  type Seniority,
} from "@/lib/jobs/types";

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
  unknown: "Unspecified",
};

const SENIORITY_LABELS: Record<Seniority, string> = {
  entry: "Entry",
  mid: "Mid",
  senior: "Senior",
  staff: "Staff+",
  unknown: "Unspecified",
};

const POSTED_WITHIN_OPTIONS = [
  { label: "Any time", value: "" },
  { label: "24h", value: "1" },
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
];

function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

function formatSalary(salary: NonNullable<JobPosting["salary"]>): string {
  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));
  const cur = salary.currency ?? "";
  const range =
    salary.min && salary.max && salary.max !== salary.min
      ? `${fmt(salary.min)}–${fmt(salary.max)}`
      : fmt(salary.min ?? salary.max ?? 0);
  return `${cur} ${range}${salary.period === "hour" ? "/hr" : "/yr"}`.trim();
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium cursor-pointer transition-colors duration-200",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function JobsBoard() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [types, setTypes] = useState<EmploymentType[]>([]);
  const [seniorities, setSeniorities] = useState<Seniority[]>([]);
  const [postedWithin, setPostedWithin] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<JobSearchResult | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (location.trim()) params.set("location", location.trim());
    if (remoteOnly) params.set("remote", "1");
    if (types.length) params.set("types", types.join(","));
    if (seniorities.length) params.set("seniority", seniorities.join(","));
    if (postedWithin) params.set("postedWithin", postedWithin);
    // The input is ₹/yr; the search layer compares in USD equivalents.
    if (salaryMin.trim() && Number(salaryMin) > 0)
      params.set("salaryMin", String(Math.round(Number(salaryMin) / INR_PER_USD)));
    params.set("page", String(page));
    return `/api/jobs?${params.toString()}`;
  }, [query, location, remoteOnly, types, seniorities, postedWithin, salaryMin, page]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(searchUrl, { signal: controller.signal });
        if (!res.ok) throw new Error("Job search is temporarily unavailable.");
        const data: JobSearchResult = await res.json();
        setResult(data);
        setJobs((prev) => (data.page > 1 ? [...prev, ...data.jobs] : data.jobs));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchUrl]);

  const resetPage = useCallback(() => setPage(1), []);

  const toggleType = (t: EmploymentType) => {
    resetPage();
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };
  const toggleSeniority = (s: Seniority) => {
    resetPage();
    setSeniorities((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const facetCount = (
    facets: { value: string; count: number }[] | undefined,
    value: string,
  ) => facets?.find((f) => f.value === value)?.count ?? 0;

  const degradedSources = result?.sources.filter((s) => s.status === "degraded") ?? [];

  const prepForJob = (job: JobPosting) => {
    const jd = [
      `${job.title} at ${job.company}`,
      job.location.raw ? `Location: ${job.location.raw}` : "",
      "",
      job.descriptionText,
    ]
      .filter(Boolean)
      .join("\n");
    sessionStorage.setItem("jobs:prefill-jd", jd);
    router.push("/analyze");
  };

  const hasMore = result ? page * result.pageSize < result.total : false;

  // Infinite loading: a sentinel below the list requests the next page as it
  // scrolls into view. Guarded by refs so the observer never fires while a
  // fetch is already in flight.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const canLoadMoreRef = useRef(false);
  canLoadMoreRef.current = hasMore && !loading && !error;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && canLoadMoreRef.current) {
          canLoadMoreRef.current = false;
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "400px 0px" }, // prefetch before the user reaches the end
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: search, location, filter toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => {
              resetPage();
              setQuery(e.target.value);
            }}
            placeholder="Search titles and descriptions…"
            className="pl-9"
          />
        </div>
        <div className="relative sm:w-52">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            value={location}
            onChange={(e) => {
              resetPage();
              setLocation(e.target.value);
            }}
            placeholder="Location"
            className="pl-9"
          />
        </div>
        <Button
          variant={showFilters ? "secondary" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
          className="cursor-pointer gap-2"
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {(types.length > 0 || seniorities.length > 0 || salaryMin) && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {types.length + seniorities.length + (salaryMin ? 1 : 0)}
            </span>
          )}
        </Button>
      </div>

      {/* Quick chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          active={remoteOnly}
          onClick={() => {
            resetPage();
            setRemoteOnly((v) => !v);
          }}
        >
          <Globe className="size-3" />
          Remote only
        </FilterChip>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <span className="text-xs text-muted-foreground mr-0.5">Posted:</span>
        {POSTED_WITHIN_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            active={postedWithin === opt.value}
            onClick={() => {
              resetPage();
              setPostedWithin(opt.value);
            }}
          >
            {opt.label}
          </FilterChip>
        ))}
      </div>

      {/* Expanded filters */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Employment type
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]).map((t) => (
                    <FilterChip key={t} active={types.includes(t)} onClick={() => toggleType(t)}>
                      {EMPLOYMENT_TYPE_LABELS[t]}
                      <span className="opacity-60 font-mono-tabular">
                        {facetCount(result?.facets.employmentTypes, t)}
                      </span>
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Seniority</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(SENIORITY_LABELS) as Seniority[]).map((s) => (
                    <FilterChip
                      key={s}
                      active={seniorities.includes(s)}
                      onClick={() => toggleSeniority(s)}
                    >
                      {SENIORITY_LABELS[s]}
                      <span className="opacity-60 font-mono-tabular">
                        {facetCount(result?.facets.seniorities, s)}
                      </span>
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Min salary (₹ per year)
                </p>
                <Input
                  type="number"
                  min={0}
                  step={100000}
                  value={salaryMin}
                  onChange={(e) => {
                    resetPage();
                    setSalaryMin(e.target.value);
                  }}
                  placeholder="e.g. 1500000"
                  className="w-44"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {salaryMin.trim() && Number(salaryMin) > 0
                    ? `≈ $${Math.round(Number(salaryMin) / INR_PER_USD).toLocaleString()}/yr — foreign salaries are converted for comparison.`
                    : "Matches only postings that publish a salary."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Degraded sources notice */}
      {degradedSources.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 shrink-0 text-primary" />
          Some sources are temporarily degraded (
          {degradedSources.map((s) => s.source).join(", ")}) — showing last known
          listings where available.
        </div>
      )}

      {/* Result count */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-sm text-muted-foreground">
          {loading && page === 1 ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Searching boards…
            </span>
          ) : result ? (
            <>
              <span className="font-medium text-foreground font-mono-tabular">
                {result.total.toLocaleString()}
              </span>{" "}
              open roles
            </>
          ) : null}
        </p>
        {result && (
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/70">
            {result.sources.filter((s) => s.status === "ok").length} sources live
          </p>
        )}
      </div>

      {/* Job rows */}
      <div className="flex flex-col gap-2">
        {error && (
          <div className="rounded-xl border border-border bg-card py-14 text-center text-muted-foreground">
            <AlertTriangle className="size-8 mx-auto mb-3 text-destructive/70" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!error &&
          jobs.map((job) => (
            <div
              key={job.id}
              className="group rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-primary/40"
            >
              <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="truncate text-sm font-medium text-foreground">
                      {job.title}
                    </h3>
                    {job.location.isRemote && (
                      <Badge
                        variant="outline"
                        className="border-primary/25 bg-primary/10 text-[10px] uppercase text-primary"
                      >
                        Remote
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="size-3" /> {job.company}
                    </span>
                    {job.location.raw && (
                      <span className="flex max-w-56 items-center gap-1 truncate">
                        <MapPin className="size-3 shrink-0" /> {job.location.raw}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-primary" /> {relativeDate(job.postedAt)}
                    </span>
                    {job.salary && (
                      <span className="flex items-center gap-1 font-medium text-foreground/80">
                        <Banknote className="size-3 text-primary" />{" "}
                        {formatSalary(job.salary)}
                      </span>
                    )}
                    {job.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => prepForJob(job)}
                    disabled={!job.descriptionText}
                    title={
                      job.descriptionText
                        ? "Run a resume-fit analysis against this JD, then interview for it"
                        : "This source doesn't publish full descriptions"
                    }
                    className="cursor-pointer gap-1.5"
                  >
                    <Mic className="size-3.5" />
                    Prep for this job
                  </Button>
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                  >
                    View posting
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}

        {!error && !loading && jobs.length === 0 && (
          <div className="rounded-xl border border-border bg-card py-14 text-center text-muted-foreground">
            <Search className="size-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No roles match these filters.</p>
            <p className="mt-1 text-xs">Try widening the search or clearing a filter.</p>
          </div>
        )}

        {loading && page === 1 && jobs.length === 0 && !error && (
          <div className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="mb-2 h-3.5 w-2/5 rounded bg-secondary" />
                <div className="h-3 w-3/5 rounded bg-secondary" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Infinite-scroll sentinel — kept mounted so the observer stays attached */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {loading && page > 1 && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading more roles…
        </div>
      )}

      {!hasMore && !loading && !error && jobs.length > 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          You&apos;ve reached the end — {result?.total.toLocaleString()} roles shown.
        </p>
      )}
    </div>
  );
}
