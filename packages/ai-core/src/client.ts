import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";

let instance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!instance) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    instance = new GoogleGenAI({ apiKey });
  }
  return instance;
}

// Map tasks to Gemini models
export const ANALYSIS_MODEL = "gemini-2.5-flash";
export const EXTRACTION_MODEL = "gemini-2.5-flash";
export const REPORT_MODEL = "gemini-2.5-pro";

// Helper to recursively map lowercase JSON Schema types to uppercase for Gemini's OpenAPI Schema requirements
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  const result: any = { ...schema };

  // Handle union types (like ["string", "null"] generated for optional/nullable Zod fields)
  if (Array.isArray(result.type)) {
    const isNullable = result.type.some(
      (t: any) => typeof t === "string" && t.toLowerCase() === "null"
    );
    const mainType = result.type.find(
      (t: any) => typeof t === "string" && t.toLowerCase() !== "null"
    );

    if (mainType) {
      result.type = String(mainType).toUpperCase();
    } else {
      result.type = "STRING";
    }

    if (isNullable) {
      result.nullable = true;
    }
  } else if (typeof result.type === "string") {
    result.type = result.type.toUpperCase();
  }

  // Recursively map properties
  if (result.properties) {
    const properties: any = {};
    for (const key of Object.keys(result.properties)) {
      properties[key] = toGeminiSchema(result.properties[key]);
    }
    result.properties = properties;
  }

  // Recursively map array items
  if (result.items) {
    result.items = toGeminiSchema(result.items);
  }

  // Enforce required field constraints (Gemini only allows required on OBJECT type)
  if (result.required) {
    if (result.type === "OBJECT") {
      if (!Array.isArray(result.required) || result.required.length === 0) {
        delete result.required;
      }
    } else {
      if (result.properties) {
        result.type = "OBJECT";
      } else {
        delete result.required;
      }
    }
  }

  // Clean up keys unsupported by Gemini OpenAPI schema spec
  delete result.additionalProperties;
  delete result.anyOf;
  delete result.allOf;
  delete result.oneOf;
  
  if (result.describe) {
    result.description = result.describe;
    delete result.describe;
  }

  return result;
}

/**
 * Forces Gemini to return JSON matching `schema` using responseSchema
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
  allowThinking?: boolean;
}): Promise<T> {
  const client = getGeminiClient();

  // Map incoming model names to Gemini equivalents
  let modelName = params.model ?? ANALYSIS_MODEL;
  if (modelName === "claude-sonnet-5") {
    modelName = ANALYSIS_MODEL;
  } else if (modelName === "claude-haiku-4-5") {
    modelName = EXTRACTION_MODEL;
  } else if (modelName === "claude-opus-4-8") {
    modelName = REPORT_MODEL;
  }

  const geminiSchema = toGeminiSchema(params.inputSchema);

  const response = await client.models.generateContent({
    model: modelName,
    contents: params.prompt,
    config: {
      systemInstruction: params.system,
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
      maxOutputTokens: params.maxTokens,
      // Configure thinking config if allowThinking is true for 2.5 Pro
      thinkingConfig: params.allowThinking && modelName === REPORT_MODEL 
        ? { thinkingBudget: 2048 } 
        : undefined,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[gemini] ${params.toolName} — model=${modelName} response=${response.text ? 'received' : 'empty'}`
    );
  }

  const text = response.text;
  if (!text) {
    throw new Error(`Gemini did not return any text for ${params.toolName}`);
  }

  let cleanText = text.trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
  }
  
  const firstBrace = cleanText.indexOf("{");
  const lastBrace = cleanText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  const parsedJson = JSON.parse(cleanText);
  return params.zodSchema.parse(parsedJson);
}

