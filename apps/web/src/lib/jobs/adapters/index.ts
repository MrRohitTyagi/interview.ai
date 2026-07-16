import type { SourceAdapter } from "../types";
import { adzunaAdapter } from "./adzuna";
import { arbeitnowAdapter } from "./arbeitnow";
import { ashbyAdapter } from "./ashby";
import { greenhouseAdapter } from "./greenhouse";
import { himalayasAdapter } from "./himalayas";
import { jobicyAdapter } from "./jobicy";
import { leverAdapter } from "./lever";
import { recruiteeAdapter } from "./recruitee";
import { remoteokAdapter } from "./remoteok";
import { remotiveAdapter } from "./remotive";
import { smartrecruitersAdapter } from "./smartrecruiters";
import { usajobsAdapter } from "./usajobs";

export const ADAPTERS: SourceAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  smartrecruitersAdapter,
  recruiteeAdapter,
  arbeitnowAdapter,
  remoteokAdapter,
  remotiveAdapter,
  jobicyAdapter,
  himalayasAdapter,
  adzunaAdapter,
  usajobsAdapter,
];
