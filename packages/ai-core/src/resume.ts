import { z } from "zod";

import { EXTRACTION_MODEL, extractStructured } from "./client";
import { UNTRUSTED_CONTENT_GUARD, wrapUntrusted } from "./prompt-safety";

export const resumeAnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence overview of the candidate"),
  skills: z.array(z.string()),
  companies: z.array(z.string()),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      technologies: z.array(z.string()),
    })
  ),
  achievements: z.array(z.string()),
  technologies: z.array(z.string()),
  claims: z.array(z.string()).describe("Specific factual claims worth probing in an interview, e.g. 'led a team of 5'"),
  strongAreas: z.array(z.string()),
  weakAreas: z.array(z.string()).describe("Areas that seem underdeveloped or vague based on the resume alone"),
  suggestedTopics: z.array(z.string()).describe("Interview topics this resume suggests are worth covering"),
});

export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;

const RESUME_ANALYSIS_TOOL_SCHEMA = {
  properties: {
    summary: { type: "string" },
    skills: { type: "array", items: { type: "string" } },
    companies: { type: "array", items: { type: "string" } },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          technologies: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
        required: ["name", "description", "technologies"],
      },
    },
    achievements: { type: "array", items: { type: "string" } },
    technologies: { type: "array", items: { type: "string" } },
    claims: { type: "array", items: { type: "string" } },
    strongAreas: { type: "array", items: { type: "string" } },
    weakAreas: { type: "array", items: { type: "string" } },
    suggestedTopics: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "skills",
    "companies",
    "projects",
    "achievements",
    "technologies",
    "claims",
    "strongAreas",
    "weakAreas",
    "suggestedTopics",
  ],
};

export async function analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
  return extractStructured({
    system:
      "You are a senior technical recruiter analyzing a candidate's resume ahead of a mock " +
      "technical interview. Extract structured, factual information — don't invent details " +
      "that aren't supported by the text. " +
      UNTRUSTED_CONTENT_GUARD,
    prompt:
      `Analyze this resume and record your findings using the record_resume_analysis tool.\n\n` +
      wrapUntrusted("resume", resumeText),
    toolName: "record_resume_analysis",
    toolDescription: "Records structured analysis of a candidate's resume.",
    inputSchema: RESUME_ANALYSIS_TOOL_SCHEMA,
    zodSchema: resumeAnalysisSchema,
    model: EXTRACTION_MODEL,
    maxTokens: 4096,
  });
}
