import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

let instance: Anthropic | null = null;

// Lazy so importing this module (e.g. Next.js collecting route page data at
// build time) never requires ANTHROPIC_API_KEY to be set — only actually
// calling Claude does.
function getAnthropic(): Anthropic {
  if (!instance) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    instance = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return instance;
}

// Gap analysis is the one call that needs real comparative judgment (resume
// vs. JD fit) — keep it on Sonnet 5. See LLD Section 4.
export const ANALYSIS_MODEL = "claude-sonnet-5";

// Resume/JD analysis is structured extraction from text, not multi-step
// reasoning — Haiku 4.5 is plenty capable here at roughly half Sonnet's
// per-token price.
export const EXTRACTION_MODEL = "claude-haiku-4-5";

// Report generation (Evaluation + Coach Agent) runs once, async, after the
// interview ends — not latency-critical, and the report is the artifact the
// candidate actually keeps. Worth the higher-quality tier. See LLD Section 4.
export const REPORT_MODEL = "claude-opus-4-8";

/**
 * Forces Claude to return JSON matching `schema` by defining it as a tool
 * and forcing tool_choice — more reliable than asking for JSON in prose.
 */
export async function extractStructured<T>(params: {
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  zodSchema: z.ZodType<T>;
  model?: string;
  maxTokens?: number;
  // Most tool-forced schema-filling calls don't benefit from extended
  // thinking (there's no multi-step reasoning to do). Calls that involve
  // real judgment — e.g. the Interview Agent deciding whether to follow up —
  // can opt back in.
  allowThinking?: boolean;
}): Promise<T> {
  const response = await getAnthropic().messages.create({
    model: params.model ?? ANALYSIS_MODEL,
    max_tokens: params.maxTokens ?? 2048,
    thinking: params.allowThinking ? { type: "adaptive" } : { type: "disabled" },
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        // strict: true makes the API guarantee tool_use.input validates
        // exactly against the schema (type, required fields, no extras) —
        // without it, tool-calling is only best-effort schema-following, and
        // edge cases (e.g. a near-empty array) can come back the wrong shape.
        strict: true,
        input_schema: {
          type: "object",
          additionalProperties: false,
          ...params.inputSchema,
        },
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[claude] ${params.toolName} — model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens} stop=${response.stop_reason}`
    );
  }

  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `Claude's response for ${params.toolName} was cut off at the max_tokens limit ` +
        `(${params.maxTokens ?? 2048}) before finishing — raise maxTokens for this call.`
    );
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Claude did not return a tool_use block for ${params.toolName}`);
  }

  return params.zodSchema.parse(toolUse.input);
}
