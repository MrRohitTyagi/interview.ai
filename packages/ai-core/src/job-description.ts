import { z } from "zod";

import { EXTRACTION_MODEL, extractStructured } from "./client";
import { UNTRUSTED_CONTENT_GUARD, wrapUntrusted } from "./prompt-safety";

export const jdAnalysisSchema = z.object({
  summary: z.string(),
  requiredSkills: z.array(z.string()),
  preferredTechnologies: z.array(z.string()),
  seniority: z.string().describe("e.g. 'Mid-level', 'Senior', 'Staff'"),
  experienceRange: z.string().describe("e.g. '3-5 years'"),
  responsibilities: z.array(z.string()),
});

export type JDAnalysis = z.infer<typeof jdAnalysisSchema>;

const JD_ANALYSIS_TOOL_SCHEMA = {
  properties: {
    summary: { type: "string" },
    requiredSkills: { type: "array", items: { type: "string" } },
    preferredTechnologies: { type: "array", items: { type: "string" } },
    seniority: { type: "string" },
    experienceRange: { type: "string" },
    responsibilities: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "requiredSkills",
    "preferredTechnologies",
    "seniority",
    "experienceRange",
    "responsibilities",
  ],
};

export async function analyzeJobDescription(jdText: string): Promise<JDAnalysis> {
  return extractStructured({
    system:
      "You are a senior technical recruiter analyzing a job description ahead of structuring " +
      "a mock interview around it. Extract structured, factual information only. " +
      UNTRUSTED_CONTENT_GUARD,
    prompt:
      `Analyze this job description and record your findings using the record_jd_analysis tool.\n\n` +
      wrapUntrusted("job_description", jdText),
    toolName: "record_jd_analysis",
    toolDescription: "Records structured analysis of a job description.",
    inputSchema: JD_ANALYSIS_TOOL_SCHEMA,
    zodSchema: jdAnalysisSchema,
    model: EXTRACTION_MODEL,
    maxTokens: 2048,
  });
}
