import { z } from "zod";

import { ANALYSIS_MODEL, extractStructured } from "./client";
import type { GapAnalysis } from "./gap-analysis";
import type { JDAnalysis } from "./job-description";
import { UNTRUSTED_CONTENT_GUARD, wrapUntrusted } from "./prompt-safety";
import type { ResumeAnalysis } from "./resume";

export const interviewTypeSchema = z.enum(["technical", "resume", "experience", "hr", "mixed"]);
export type InterviewType = z.infer<typeof interviewTypeSchema>;

// Real technical interviews spend real time on baseline competency that any
// candidate for the role's stack would be asked — not just recall of what's
// literally written on the resume. Skipping that phase is what makes a mock
// interview feel like a "resume explanation session" instead of an actual
// interview. See TYPE_GUIDANCE below for where this applies.
const CORE_FUNDAMENTALS_RULE =
  "Identify the candidate's primary language/framework/stack from their resume and the job " +
  "description (e.g. React, Node.js, Python, SQL, distributed systems). Plan at least 2 topics " +
  "that are pure fundamentals checks on that stack — the kind of baseline questions any " +
  "candidate with that stack would be asked, independent of anything specific on their resume " +
  "(examples: a React developer gets asked about closures, the event loop, hooks rules, " +
  "reconciliation, and re-render behavior; a backend engineer gets asked about complexity, core " +
  "data structures, concurrency, and async patterns; a Python engineer gets asked about the GIL, " +
  "memory model, and generators). These must be genuinely general-knowledge questions, not " +
  "reframed versions of a resume project.";

const TYPE_GUIDANCE: Record<InterviewType, string> = {
  technical:
    "This must feel like a real technical interview, not a resume walkthrough. Structure the " +
    "topics as: (1) exactly one brief warm-up/intro topic — nothing more, (2) at least 2 core " +
    "fundamentals topics (see rule below), (3) the remaining topics grounded in the candidate's " +
    "actual resume experience — specific projects, decisions, depth, (4) for medium or hard " +
    "difficulty, include at least one system-design or architecture topic. Increase difficulty " +
    "progressively across all of it.\n\n" +
    CORE_FUNDAMENTALS_RULE,
  resume:
    "Every topic must map directly to something specific on the resume — a named project, " +
    "company, or claimed achievement. Do not introduce generic technical topics that aren't " +
    "grounded in the resume. Dig into what they actually did, their specific role, and the " +
    "details behind each claim.",
  experience:
    "Focus on past roles, decisions, and outcomes rather than abstract technical trivia. For " +
    "each topic, target a specific decision the candidate made, why they made it, what the " +
    "alternatives were, and what happened as a result.",
  hr:
    "This is a behavioral / culture-fit interview, not a technical one. Focus on motivation, " +
    "teamwork, conflict resolution, communication style, career goals, and how the candidate " +
    "handles ambiguity or pressure. Do not plan technical or system-design topics.",
  mixed:
    "Build a balanced sequence like a real interview loop: (1) a brief resume walkthrough " +
    "opener, (2) at least one core fundamentals topic (see rule below), (3) technical topics " +
    "grounded in the candidate's actual experience, increasing difficulty progressively, and " +
    "(4) one behavioral topic at the end.\n\n" +
    CORE_FUNDAMENTALS_RULE,
};

export const plannedTopicSchema = z.object({
  topic: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  guidance: z.string().describe("What the interviewer should probe for on this topic"),
});

export const interviewPlanSchema = z.object({
  topics: z.array(plannedTopicSchema),
  openingQuestion: z
    .string()
    .describe("The literal first question to ask — typically a warm resume walkthrough opener"),
});

export type PlannedTopic = z.infer<typeof plannedTopicSchema>;
export type InterviewPlan = z.infer<typeof interviewPlanSchema>;

const PLAN_TOOL_SCHEMA = {
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          guidance: { type: "string" },
        },
        additionalProperties: false,
        required: ["topic", "difficulty", "guidance"],
      },
    },
    openingQuestion: { type: "string" },
  },
  required: ["topics", "openingQuestion"],
};

export function topicCountForDuration(durationMinutes: number): number {
  return Math.min(8, Math.max(4, Math.round(durationMinutes / 4)));
}

// A handful of concretely different shapes for the opening line — without
// this, the model reliably converges on one "walk me through your
// background" phrasing across sessions since that's the single most
// obvious way to satisfy a generic "warm invitation" instruction. Naming
// several genuinely different real-interviewer openers and asking the
// model to pick (or invent a comparable one) is what actually produces
// variety turn to turn, not just telling it to "vary the phrasing."
const OPENER_STYLES = [
  "leading with their most recent role or company by name",
  "leading with a specific standout project or achievement from their resume",
  "a brief self-intro from the interviewer followed by an open invitation to introduce themselves",
  "a direct, curious question about what they're most proud of building",
  "referencing something specific in the job description they're interviewing for and asking how their background connects to it",
];

export async function generateInterviewPlan(params: {
  resume: ResumeAnalysis;
  jd: JDAnalysis | null;
  gap: GapAnalysis | null;
  difficulty: "easy" | "medium" | "hard";
  durationMinutes: number;
  interviewType: InterviewType;
  customInstructions?: string | null;
  candidateName: string;
}): Promise<InterviewPlan> {
  const topicCount = topicCountForDuration(params.durationMinutes);
  const openerStyle = OPENER_STYLES[Math.floor(Math.random() * OPENER_STYLES.length)];

  return extractStructured({
    model: ANALYSIS_MODEL,
    maxTokens: 3072,
    system:
      "You are a senior interviewer planning a mock interview. Never plan duplicate topics.\n\n" +
      TYPE_GUIDANCE[params.interviewType] +
      "\n\nOrder the topics array the way a real interview actually ramps up: topics[0] should " +
      "be the most approachable (a warm-up), and difficulty should climb progressively so the " +
      `hardest topic lands last. Vary the difficulty field across topics accordingly — don't ` +
      `mark every topic the same level, even within an overall "${params.difficulty}"-difficulty ` +
      "interview (e.g. a hard interview should still open with an easier topic before ramping " +
      "up, not start at maximum difficulty).\n\n" +
      "Write each topic's `guidance` and the opening question the way a real interviewer would " +
      "actually talk: short, plain, conversational sentences, not written prose, with the " +
      "warm, easy rhythm of a friendly senior Indian tech professional, not a tight or overly " +
      "serious script. NEVER use en-dashes (\u2013), em-dashes (\u2014), or double-hyphens (--) in the opening question or guidance; use standard punctuation instead. Interviewer turns built from this plan may be read aloud by " +
      "text-to-speech." +
      (params.gap
        ? "\n\nPrioritize topics from the gap analysis where the candidate's fit is uncertain."
        : "") +
      (params.customInstructions
        ? "\n\nThe candidate also left additional instructions for this session — follow them " +
          "unless they'd undermine the interview's value (e.g. asking to skip all hard " +
          "questions). " +
          UNTRUSTED_CONTENT_GUARD
        : ""),
    prompt:
      `Plan a ${params.durationMinutes}-minute ${params.difficulty}-difficulty interview with ` +
      `exactly ${topicCount} topics, plus an opening question, using the record_interview_plan tool.\n\n` +
      `Candidate's first name: ${params.candidateName}\n\n` +
      `Candidate profile:\n${JSON.stringify(params.resume, null, 2)}\n\n` +
      (params.jd ? `Job description:\n${JSON.stringify(params.jd, null, 2)}\n\n` : "") +
      (params.gap ? `Gap analysis:\n${JSON.stringify(params.gap, null, 2)}\n\n` : "") +
      (params.customInstructions
        ? wrapUntrusted("candidate_instructions", params.customInstructions) + "\n\n"
        : "") +
      `The opening question is one or two short, casual, spoken sentences — greet the candidate ` +
      `by their first name, introduce yourself as John (do not use generic placeholders like [Interviewer Name] or [Your Name]), ` +
      `and write it ${openerStyle}. It must reference something concrete and ` +
      `specific from THIS candidate's actual resume above (a real project, company, or skill name) ` +
      `— never a generic line that could apply to any candidate, and not a technical question yet.`,
    toolName: "record_interview_plan",
    toolDescription: "Records the planned topic sequence and opening question for the interview.",
    inputSchema: PLAN_TOOL_SCHEMA,
    zodSchema: interviewPlanSchema,
  });
}
