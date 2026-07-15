import { z } from "zod";

import { ANALYSIS_MODEL, extractStructured } from "./client";
import type { InterviewType, PlannedTopic } from "./interview-planner";
import type { JDAnalysis } from "./job-description";
import { UNTRUSTED_CONTENT_GUARD, wrapUntrusted } from "./prompt-safety";
import type { ResumeAnalysis } from "./resume";

// Shared with the orchestrator (API route) so both sides agree on the cap —
// the constraint is enforced by telling Claude about it *before* it decides,
// not by silently overriding its choice after the fact (see processTurn).
export const MAX_FOLLOW_UPS_PER_TOPIC = 2;

// Governs how the interviewer actually sounds turn to turn — separate from
// PERSONA_BY_TYPE, which only sets subject-matter focus. Written once and
// shared across all interview types so tone stays consistent regardless of
// what's being asked. This text may be read aloud by text-to-speech in
// voice mode, so it explicitly steers away from written-prose habits.
const NATURAL_TONE_GUIDE =
  "Sound like a real person interviewing someone on a call, not a chatbot — warm and human, " +
  "not stiff or overly serious. Concretely:\n" +
  '- Keep questions SHORT — one sentence, occasionally two. Real interviewers don\'t monologue ' +
  "or stack context before asking something.\n" +
  '- Use plain, conversational language and contractions ("you\'re", "what\'d", "didn\'t") — ' +
  "never corporate, academic, or overly formal phrasing.\n" +
  "- Speak with the warm, easy rhythm of a friendly senior Indian tech professional chatting on " +
  "a call — not a tight, clipped script. Natural sentence-starters like \"So...\", " +
  "\"Actually...\", \"See...\", \"Right, so...\", \"Now...\" are welcome, and mild warm " +
  "repetition for emphasis (\"good, good\", \"okay okay\", \"right, right\") is fine now and " +
  "then. The tone should feel encouraging and personable even while probing for depth — like a " +
  "friendly senior colleague, not an examiner reading off a checklist.\n" +
  "- Before a follow-up or topic change, react briefly and naturally to what they just said — " +
  'a short, real reaction ("Got it", "Nice", "Good, good", "Hm, okay", "Interesting approach") ' +
  "— not a restatement or summary of their answer, and not the same reaction every time. Don't " +
  "force enthusiasm if the answer was thin or mediocre, but stay warm rather than going flat or " +
  "cold — redirect gently, the way a friendly senior interviewer would, not curtly.\n" +
  "- Ask ONE question at a time. Never stack multiple questions in a single turn.\n" +
  "- Don't over-explain why you're asking something, preview what's coming next, or narrate " +
  "your own process.\n" +
  "- Match your question's depth to the topic's stated difficulty — easy topics should read " +
  "like a warm-up, hard topics should genuinely push.\n" +
  "- This will likely be read aloud by text-to-speech, so write it exactly as a person would " +
  "say it out loud — no bullet points, numbered lists, or markdown.\n" +
  "- You know the candidate's first name (given below). Use it occasionally where a real " +
  "interviewer naturally would — acknowledging a strong answer, redirecting gently, or the " +
  "closing remark — never in every turn or mid-question, which would sound robotic.";

const PERSONA_BY_TYPE: Record<InterviewType, string> = {
  technical:
    "You are a senior technical interviewer. Stay focused on technical depth — " +
    "architecture, trade-offs, implementation detail. Avoid HR-style questions about " +
    "motivation or culture fit.",
  resume:
    "You are a senior interviewer conducting a resume deep-dive. Stay grounded in what's " +
    "actually on the candidate's resume — don't invent hypothetical technical scenarios " +
    "unrelated to their stated experience.",
  experience:
    "You are a senior interviewer focused on the candidate's real past decisions and " +
    "outcomes. Probe the reasoning behind their choices, not abstract technical knowledge.",
  hr:
    "You are an HR / behavioral interviewer. Focus on motivation, communication, teamwork, " +
    "and culture fit. Do not ask technical questions — if the candidate's answer drifts into " +
    "technical mechanics, redirect toward how they approached it as a person and teammate.",
  mixed:
    "You are a senior technical interviewer conducting a well-rounded interview covering " +
    "both technical and behavioral ground.",
};

// Kept intentionally minimal — every field here is either consumed
// downstream (mistakes/confidence feed weakTopics tracking; action/
// nextQuestion drive the turn itself) or earns its keep as a cheap
// reasoning step before the model commits to action/nextQuestion.
// answerSummary/technologiesMentioned/followUpOpportunities used to be
// generated every turn and were never read anywhere — pure wasted
// generation time — so they were cut. See client.ts's extractStructured:
// output token count directly drives wall-clock latency on a non-thinking
// call, and this was ~15-25% of the response for zero downstream value.
export const conversationTurnSchema = z.object({
  mistakes: z.array(z.string()).describe("Anything incorrect, vague, or unsupported in the answer"),
  confidence: z.enum(["low", "medium", "high"]),
  action: z.enum(["follow_up", "next_topic", "wrap_up"]),
  nextQuestion: z
    .string()
    .min(10, "nextQuestion must be real content, not a placeholder")
    .describe(
      "What to say next: a follow-up question, the next topic's opening question, or — for " +
        "wrap_up — an actual warm closing remark thanking the candidate. Never a placeholder."
    ),
});

export type ConversationTurn = z.infer<typeof conversationTurnSchema>;

const TURN_TOOL_SCHEMA = {
  properties: {
    mistakes: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    action: { type: "string", enum: ["follow_up", "next_topic", "wrap_up"] },
    nextQuestion: { type: "string" },
  },
  required: ["mistakes", "confidence", "action", "nextQuestion"],
};

export async function processTurn(params: {
  resume: ResumeAnalysis;
  jd: JDAnalysis | null;
  currentTopic: PlannedTopic;
  nextTopic: PlannedTopic | null;
  conversationHistory: { question: string; answer: string }[];
  currentQuestion: string;
  candidateAnswer: string;
  followUpsSoFarOnTopic: number;
  isLastTopic: boolean;
  interviewType: InterviewType;
  customInstructions?: string | null;
  candidateName: string;
}): Promise<ConversationTurn> {
  const historyBlock = params.conversationHistory
    .map((turn, i) => `Q${i + 1}: ${turn.question}\nA${i + 1}: ${turn.answer}`)
    .join("\n\n");

  const atFollowUpCap = params.followUpsSoFarOnTopic >= MAX_FOLLOW_UPS_PER_TOPIC;

  return extractStructured({
    // Extended thinking was on here for the "real conversational judgment"
    // this call makes, but measured live it added several seconds per turn
    // for a decision that doesn't need multi-step reasoning — deciding
    // follow-up vs. next-topic and phrasing one question is well within a
    // non-thinking Sonnet call's depth. Disabled for latency; re-enable if
    // turn quality ever measurably suffers.
    allowThinking: false,
    maxTokens: 1536,
    system:
      PERSONA_BY_TYPE[params.interviewType] +
      " Never reveal scoring, grading, or evaluation language to the candidate; that happens " +
      "separately, out of view.\n\n" +
      NATURAL_TONE_GUIDE +
      "\n\n" +
      (params.customInstructions
        ? "The candidate left additional instructions for this session — follow them unless " +
          "they'd undermine the interview's value. " +
          UNTRUSTED_CONTENT_GUARD +
          "\n\n" +
          wrapUntrusted("candidate_instructions", params.customInstructions) +
          "\n\n"
        : "") +
      "For each answer, decide one of three actions:\n" +
      "- follow_up: the answer left something worth digging into (vague claim, interesting " +
      "detail, something that doesn't add up). Ask ONE focused follow-up.\n" +
      "- next_topic: ONLY valid when a next planned topic is given below. Briefly acknowledge " +
      "their answer, then transition naturally into that topic's question.\n" +
      "- wrap_up: ONLY valid when no next planned topic is given below (this is the last " +
      "topic) and it's sufficiently covered.\n\n" +
      "If no next planned topic is given below, next_topic is not a valid choice — pick " +
      "follow_up or wrap_up.\n\n" +
      (atFollowUpCap
        ? `This topic has already had ${params.followUpsSoFarOnTopic} follow-ups — the maximum. ` +
          "follow_up is NOT a valid choice this turn, no matter how tempting. You MUST choose " +
          "next_topic (or wrap_up if there's no next topic).\n\n"
        : "") +
      "`nextQuestion` must always contain real, complete content that matches whichever " +
      "action you chose — never a placeholder like \"N/A\" or leftover text meant for a " +
      "different action. For wrap_up specifically, `nextQuestion` must be an actual warm, " +
      "personalized 2-3 sentence closing remark thanking the candidate by name for their " +
      "time — not a placeholder, not a generic one-liner.\n\n" +
      "Never repeat a question already asked in this conversation.",
    prompt:
      `Candidate's first name: ${params.candidateName}\n\n` +
      `Candidate profile:\n${JSON.stringify(params.resume, null, 2)}\n\n` +
      (params.jd ? `Job description:\n${JSON.stringify(params.jd, null, 2)}\n\n` : "") +
      `Current topic: "${params.currentTopic.topic}" (${params.currentTopic.difficulty}) — ` +
      `${params.currentTopic.guidance}\n\n` +
      (params.nextTopic
        ? `Next planned topic: "${params.nextTopic.topic}" — ${params.nextTopic.guidance}\n\n`
        : params.isLastTopic
          ? "This is the last planned topic — there is no next topic. Choose follow_up or " +
            "wrap_up only. If wrap_up, nextQuestion must be a real closing remark.\n\n"
          : "") +
      (historyBlock ? `Conversation so far:\n${historyBlock}\n\n` : "") +
      `Most recent question: ${params.currentQuestion}\n` +
      `Candidate's answer: ${params.candidateAnswer}\n\n` +
      `Process this turn and record your decision using the record_turn tool.`,
    toolName: "record_turn",
    toolDescription: "Records analysis of the candidate's answer and the interviewer's next move.",
    inputSchema: TURN_TOOL_SCHEMA,
    zodSchema: conversationTurnSchema,
    model: ANALYSIS_MODEL,
  });
}
