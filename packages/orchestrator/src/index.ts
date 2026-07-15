import {
  MAX_FOLLOW_UPS_PER_TOPIC,
  processTurn,
  type InterviewType,
  type JDAnalysis,
  type PlannedTopic,
  type ResumeAnalysis,
} from "@ai-interviewer/ai-core";
import {
  answers,
  db,
  interviews,
  interviewStates,
  jobDescriptions,
  questions,
  resumes,
} from "@ai-interviewer/db";
import { asc, eq, inArray } from "drizzle-orm";

// Transport-agnostic on purpose: this is called from the text-chat HTTP
// route and, unchanged, from the realtime voice server after STT finalizes a
// transcript. Neither caller needs to know how a turn is actually decided.

export class InterviewNotFoundError extends Error {
  constructor() {
    super("Interview not found");
  }
}
export class InterviewNotInProgressError extends Error {
  constructor() {
    super("Interview is not in progress");
  }
}
export class InterviewStateError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface TurnResult {
  completed: boolean;
  message: string;
  topic: string | null;
}

const TIME_UP_MESSAGE =
  "We're right at the time limit for this session — let's wrap up here. Thanks so much for your answers today!";
const TOPIC_COMPLETE_MESSAGE =
  "Thanks so much for your time today — that covers everything I wanted to explore. This wraps up the interview.";

/**
 * Verifies the interview belongs to `userId` and is in progress. Throws
 * InterviewNotFoundError / InterviewNotInProgressError otherwise. Callers
 * (HTTP route, voice socket handler) map these to their own error surface.
 */
export async function loadActiveInterview(interviewId: string, userId: string) {
  const [interview] = await db.select().from(interviews).where(eq(interviews.id, interviewId)).limit(1);
  if (!interview || interview.userId !== userId) throw new InterviewNotFoundError();
  if (interview.status !== "in_progress") throw new InterviewNotInProgressError();
  return interview;
}

export async function processInterviewTurn(
  interviewId: string,
  userId: string,
  answerText: string
): Promise<TurnResult> {
  // Neither of these depends on the other's result — only on interviewId —
  // so there's no reason to make the candidate wait for two sequential
  // round trips.
  const [interview, [state]] = await Promise.all([
    loadActiveInterview(interviewId, userId),
    db.select().from(interviewStates).where(eq(interviewStates.interviewId, interviewId)).limit(1),
  ]);
  if (!state || !state.currentQuestionId) {
    throw new InterviewStateError("Interview state not found");
  }

  const [currentQuestion] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, state.currentQuestionId))
    .limit(1);
  if (!currentQuestion) throw new InterviewStateError("Current question not found");

  await db.insert(answers).values({ questionId: currentQuestion.id, transcript: answerText });

  // Enforce the real time budget. This is a deterministic check, not a
  // judgment call — skip the Claude call entirely rather than asking the
  // model to decide something we already know.
  if (interview.startedAt) {
    const elapsedSeconds = (Date.now() - interview.startedAt.getTime()) / 1000;
    if (elapsedSeconds >= interview.durationMinutes * 60) {
      const plannedTopics = state.plannedTopics as PlannedTopic[];
      const currentTopic = plannedTopics[state.currentTopicIndex];
      const coveredTopics = [...(state.coveredTopics as string[])];
      if (currentTopic && !coveredTopics.includes(currentTopic.topic)) {
        coveredTopics.push(currentTopic.topic);
      }

      await db
        .update(interviews)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(interviews.id, interviewId));
      await db
        .update(interviewStates)
        .set({ coveredTopics, updatedAt: new Date() })
        .where(eq(interviewStates.interviewId, interviewId));

      return { completed: true, message: TIME_UP_MESSAGE, topic: null };
    }
  }

  // None of these three depend on each other — only on fields already
  // resolved above — so they run concurrently instead of stacking three
  // sequential round trips.
  const [[resume], jdRows, priorQuestions] = await Promise.all([
    db.select().from(resumes).where(eq(resumes.id, interview.resumeId)).limit(1),
    interview.jdId
      ? db.select().from(jobDescriptions).where(eq(jobDescriptions.id, interview.jdId)).limit(1)
      : Promise.resolve([]),
    db.select().from(questions).where(eq(questions.interviewId, interviewId)).orderBy(asc(questions.order)),
  ]);
  const jd = jdRows[0] ?? null;

  // Was one DB round trip per prior question (N+1) — batched into one query
  // since this only grows as the interview goes on.
  const priorQuestionIds = priorQuestions.filter((q) => q.id !== currentQuestion.id).map((q) => q.id);
  const priorAnswers = priorQuestionIds.length
    ? await db.select().from(answers).where(inArray(answers.questionId, priorQuestionIds))
    : [];
  const transcriptByQuestionId = new Map(priorAnswers.map((a) => [a.questionId, a.transcript]));

  const history: { question: string; answer: string }[] = [];
  for (const q of priorQuestions) {
    if (q.id === currentQuestion.id) continue;
    const transcript = transcriptByQuestionId.get(q.id);
    if (transcript) history.push({ question: q.question, answer: transcript });
  }

  const plannedTopics = state.plannedTopics as PlannedTopic[];
  const currentTopic = plannedTopics[state.currentTopicIndex];
  const nextTopicIndex = state.currentTopicIndex + 1;
  const nextTopic: PlannedTopic | null = plannedTopics[nextTopicIndex] ?? null;
  const isLastTopic = nextTopic === null;

  const turn = await processTurn({
    resume: resume.parsedJson as ResumeAnalysis,
    jd: (jd?.parsedJson as JDAnalysis | undefined) ?? null,
    currentTopic,
    nextTopic,
    conversationHistory: history,
    currentQuestion: currentQuestion.question,
    candidateAnswer: answerText,
    followUpsSoFarOnTopic: state.followUpsOnCurrentTopic,
    isLastTopic,
    interviewType: interview.type as InterviewType,
    customInstructions: interview.customInstructions,
  });

  let action = turn.action;
  let message = turn.nextQuestion;

  // Defense in depth: processTurn already tells Claude about the cap before
  // it decides, so this should rarely fire. If it does anyway, don't trust
  // `turn.nextQuestion` — it was generated for the action Claude *wanted*
  // to take, not the one we're forcing, so reusing it here would show the
  // candidate content that doesn't match what's actually happening.
  if (action === "follow_up" && state.followUpsOnCurrentTopic + 1 > MAX_FOLLOW_UPS_PER_TOPIC) {
    action = isLastTopic ? "wrap_up" : "next_topic";
    console.warn(`[interview ${interviewId}] follow-up cap override: follow_up -> ${action}`);
    message = action === "wrap_up" ? TOPIC_COMPLETE_MESSAGE : `Great, let's move on. Next up: ${nextTopic!.topic}.`;
  }
  if (action === "next_topic" && isLastTopic) {
    console.warn(`[interview ${interviewId}] last-topic override: next_topic -> wrap_up`);
    action = "wrap_up";
    message = TOPIC_COMPLETE_MESSAGE;
  }

  const coveredTopics = [...(state.coveredTopics as string[])];
  const weakTopics = [...(state.weakTopics as string[])];
  const isWeak = turn.confidence === "low" || turn.mistakes.length > 0;

  if (action === "wrap_up") {
    if (!coveredTopics.includes(currentTopic.topic)) coveredTopics.push(currentTopic.topic);
    if (isWeak && !weakTopics.includes(currentTopic.topic)) weakTopics.push(currentTopic.topic);

    await db
      .update(interviews)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(interviews.id, interviewId));
    await db
      .update(interviewStates)
      .set({ coveredTopics, weakTopics, updatedAt: new Date() })
      .where(eq(interviewStates.interviewId, interviewId));

    return { completed: true, message, topic: null };
  }

  const nextOrder = priorQuestions.length;

  if (action === "follow_up") {
    const [newQuestion] = await db
      .insert(questions)
      .values({
        interviewId,
        parentQuestionId: currentQuestion.id,
        topic: currentTopic.topic,
        difficulty: currentTopic.difficulty,
        question: message,
        order: nextOrder,
        askedAt: new Date(),
      })
      .returning();

    await db
      .update(interviewStates)
      .set({
        currentQuestionId: newQuestion.id,
        followUpsOnCurrentTopic: state.followUpsOnCurrentTopic + 1,
        updatedAt: new Date(),
      })
      .where(eq(interviewStates.interviewId, interviewId));

    return { completed: false, message, topic: currentTopic.topic };
  }

  // action === "next_topic"
  if (!coveredTopics.includes(currentTopic.topic)) coveredTopics.push(currentTopic.topic);
  if (isWeak && !weakTopics.includes(currentTopic.topic)) weakTopics.push(currentTopic.topic);

  const [newQuestion] = await db
    .insert(questions)
    .values({
      interviewId,
      parentQuestionId: null,
      topic: nextTopic!.topic,
      difficulty: nextTopic!.difficulty,
      question: message,
      order: nextOrder,
      askedAt: new Date(),
    })
    .returning();

  await db
    .update(interviewStates)
    .set({
      currentQuestionId: newQuestion.id,
      currentTopicIndex: nextTopicIndex,
      followUpsOnCurrentTopic: 0,
      coveredTopics,
      weakTopics,
      updatedAt: new Date(),
    })
    .where(eq(interviewStates.interviewId, interviewId));

  return { completed: false, message, topic: nextTopic!.topic };
}
