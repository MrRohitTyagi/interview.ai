import { z } from "zod";

import { extractStructured, REPORT_MODEL } from "./client";
import type { InterviewType } from "./interview-planner";
import type { JDAnalysis } from "./job-description";
import type { ResumeAnalysis } from "./resume";

export const answerEvaluationSchema = z.object({
  questionIndex: z.number().describe("0-based index into the transcript array"),
  technicalScore: z.number().min(0).max(100),
  communicationScore: z.number().min(0).max(100),
  completenessScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  problemSolvingScore: z.number().min(0).max(100),
  notes: z.string().describe("1-2 sentences on what was strong or weak about this specific answer"),
});

export const studyRoadmapItemSchema = z.object({
  topic: z.string(),
  why: z.string().describe("Why this is worth studying, grounded in what happened in the interview"),
  resources: z.array(z.string()).describe("Concrete resource names or search terms, not URLs"),
});

export const interviewReportSchema = z.object({
  answerEvaluations: z.array(answerEvaluationSchema),
  overallTechnicalScore: z.number().min(0).max(100),
  overallCommunicationScore: z.number().min(0).max(100),
  recommendation: z
    .string()
    .describe("A short hiring-style verdict, e.g. 'Strong hire', 'Lean hire', 'Lean no hire', with a one-sentence rationale"),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  studyRoadmap: z.array(studyRoadmapItemSchema),
  summary: z.string().describe("3-4 sentence overall summary of the candidate's performance"),
});

export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>;
export type StudyRoadmapItem = z.infer<typeof studyRoadmapItemSchema>;
export type InterviewReport = z.infer<typeof interviewReportSchema>;

const REPORT_TOOL_SCHEMA = {
  properties: {
    answerEvaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionIndex: { type: "number" },
          technicalScore: { type: "number" },
          communicationScore: { type: "number" },
          completenessScore: { type: "number" },
          confidenceScore: { type: "number" },
          problemSolvingScore: { type: "number" },
          notes: { type: "string" },
        },
        additionalProperties: false,
        required: [
          "questionIndex",
          "technicalScore",
          "communicationScore",
          "completenessScore",
          "confidenceScore",
          "problemSolvingScore",
          "notes",
        ],
      },
    },
    overallTechnicalScore: { type: "number" },
    overallCommunicationScore: { type: "number" },
    recommendation: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    studyRoadmap: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          why: { type: "string" },
          resources: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
        required: ["topic", "why", "resources"],
      },
    },
    summary: { type: "string" },
  },
  required: [
    "answerEvaluations",
    "overallTechnicalScore",
    "overallCommunicationScore",
    "recommendation",
    "strengths",
    "weaknesses",
    "studyRoadmap",
    "summary",
  ],
};

export async function generateReport(params: {
  transcript: { topic: string; question: string; answer: string }[];
  resume: ResumeAnalysis;
  jd: JDAnalysis | null;
  interviewType: InterviewType;
}): Promise<InterviewReport> {
  const transcriptBlock = params.transcript
    .map((t, i) => `[${i}] Topic: ${t.topic}\nQ: ${t.question}\nA: ${t.answer}`)
    .join("\n\n");

  return extractStructured({
    model: REPORT_MODEL,
    maxTokens: 8192,
    system:
      "You are an expert technical hiring evaluator and career coach reviewing a completed " +
      "mock interview transcript. Be honest and calibrated — a candidate who did well " +
      "deserves high scores, and a candidate who struggled deserves that reflected " +
      "accurately. Do not inflate scores to be encouraging; the value of this report comes " +
      "from it being accurate. Ground every score and note in specific evidence from the " +
      "transcript, not general impressions. Scores are 0-100. The study roadmap should be " +
      "concrete and actionable, tied to specific gaps observed in this interview, not generic " +
      "advice.",
    prompt:
      `This was a ${params.interviewType} interview. Evaluate every answer in the transcript ` +
      `below and produce a full report using the record_interview_report tool.\n\n` +
      `Candidate profile:\n${JSON.stringify(params.resume, null, 2)}\n\n` +
      (params.jd ? `Job description:\n${JSON.stringify(params.jd, null, 2)}\n\n` : "") +
      `Transcript:\n${transcriptBlock}`,
    toolName: "record_interview_report",
    toolDescription: "Records per-answer evaluations and the overall interview report.",
    inputSchema: REPORT_TOOL_SCHEMA,
    zodSchema: interviewReportSchema,
  });
}
