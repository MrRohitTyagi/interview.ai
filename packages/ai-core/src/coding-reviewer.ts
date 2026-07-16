import { z } from "zod";
import { ANALYSIS_MODEL, extractStructured } from "./client";

export const codeReviewSchema = z.object({
  score: z.number().describe("Overall score out of 10 based strictly on the problem requirements, architecture, and efficiency"),
  isOptimal: z.boolean().describe("Whether this approach represents a standard, optimal solution"),
  timeComplexity: z.string().describe("Big O time complexity (e.g. O(N))"),
  spaceComplexity: z.string().describe("Big O space complexity (e.g. O(1))"),
  feedback: z.string().describe("1-2 paragraphs of constructive feedback. If perfect, provide a brief congratulatory message without inventing arbitrary issues."),
  improvements: z.array(z.string()).describe("Specific bullet points to improve. IMPORTANT: If the candidate perfectly implemented exactly what was asked, leave this array EMPTY. Do NOT suggest advanced features (e.g. cancel, leading edge) unless explicitly asked.")
});

export type CodeReview = z.infer<typeof codeReviewSchema>;

const CODE_REVIEW_TOOL_SCHEMA = {
  properties: {
    score: { type: "number" },
    isOptimal: { type: "boolean" },
    timeComplexity: { type: "string" },
    spaceComplexity: { type: "string" },
    feedback: { type: "string" },
    improvements: { type: "array", items: { type: "string" } }
  },
  required: ["score", "isOptimal", "timeComplexity", "spaceComplexity", "feedback", "improvements"],
};

export async function reviewCode(questionTitle: string, questionDescription: string, candidateCode: string): Promise<CodeReview> {
  return extractStructured({
    system: "You are a strict and precise Senior Staff Engineer evaluating code. Evaluate this code STRICTLY based on the problem description. Do NOT suggest advanced concepts or extra features (like immediate execution, cancel methods, abort controllers, etc.) unless they are explicitly requested. If the code optimally solves exactly what is asked, score it 10/10 and leave improvements empty. Do not invent arbitrary feedback for perfect solutions.",
    prompt: `The candidate was asked to solve the following conceptual problem:\nTITLE: ${questionTitle}\nDESCRIPTION: ${questionDescription}\n\nHere is the candidate's submitted JavaScript code:\n\`\`\`javascript\n${candidateCode}\n\`\`\`\n\nEvaluate this code and record your findings strictly adhering to the system instructions using the record_code_review tool.`,
    toolName: "record_code_review",
    toolDescription: "Records structured analysis of a candidate's code.",
    inputSchema: CODE_REVIEW_TOOL_SCHEMA,
    zodSchema: codeReviewSchema,
    model: ANALYSIS_MODEL,
    maxTokens: 4096,
  });
}
