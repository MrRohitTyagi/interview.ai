import { z } from "zod";
import { ANALYSIS_MODEL, extractStructured } from "./client";

export const codeReviewSchema = z.object({
  score: z.number().describe("Overall score out of 100 based on architecture, efficiency, and cleanliness"),
  isOptimal: z.boolean().describe("Whether this approach represents a standard, optimal solution"),
  timeComplexity: z.string().describe("Big O time complexity (e.g. O(N))"),
  spaceComplexity: z.string().describe("Big O space complexity (e.g. O(1))"),
  feedback: z.string().describe("1-2 paragraphs of constructive feedback as if you were the senior engineer conducting the interview"),
  improvements: z.array(z.string()).describe("2-3 specific bullet points on how to improve the code")
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
    system: "You are a Senior Staff Engineer conducting a technical interview. Evaluate this code structurally and architecturally. We are not running unit tests on it. Determine its time/space complexity, whether it is an optimal approach, and provide direct feedback on what they did well and what could be improved.",
    prompt: `The candidate was asked to solve the following conceptual problem:\nTITLE: ${questionTitle}\nDESCRIPTION: ${questionDescription}\n\nHere is the candidate's submitted JavaScript code:\n\`\`\`javascript\n${candidateCode}\n\`\`\`\n\nEvaluate this code and record your findings using the record_code_review tool.`,
    toolName: "record_code_review",
    toolDescription: "Records structured analysis of a candidate's code.",
    inputSchema: CODE_REVIEW_TOOL_SCHEMA,
    zodSchema: codeReviewSchema,
    model: ANALYSIS_MODEL,
    maxTokens: 4096,
  });
}
