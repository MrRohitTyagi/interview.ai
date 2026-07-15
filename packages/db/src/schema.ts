import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Organizations & Users
// organizationId is nullable and unused until Phase 6 (team hiring) — added
// now so it doesn't require a migration later. See LLD Section 13.
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRoleEnum = pgEnum("user_role", ["candidate", "recruiter", "admin"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  // Nullable — OAuth-only accounts (if that path is ever re-enabled) never
  // set one. Salt+scrypt hash, stored as "salt:hash" hex, see lib/password.ts.
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("candidate"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Auth.js required tables (Drizzle adapter shape)
// ---------------------------------------------------------------------------

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// Email OTP is a numeric code the candidate types in, distinct from Auth.js's
// built-in magic-link Email provider — needs its own table. See LLD Section 3.
export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Consent — backs the camera-consent requirement in LLD Section 11
// ---------------------------------------------------------------------------

export const consentLogs = pgTable("consent_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  interviewId: uuid("interview_id").references(() => interviews.id, { onDelete: "cascade" }),
  cameraConsent: boolean("camera_consent").notNull().default(false),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Resume & Job Description
// ---------------------------------------------------------------------------

export const embeddingStatusEnum = pgEnum("embedding_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  // Original upload filename — nullable so existing rows from before this
  // column existed still read fine (UI falls back to a generic label).
  fileName: text("file_name"),
  // Extracted text, persisted at upload time. Claude analysis is deferred to
  // a combined analyze step, so the raw text has to survive until then.
  rawText: text("raw_text").notNull(),
  parsedJson: jsonb("parsed_json"),
  embeddingStatus: embeddingStatusEnum("embedding_status").notNull().default("pending"),
  // The most recent job description this resume was compared against, and
  // that comparison's result. Gap analysis was previously never persisted —
  // only returned in the /api/analyze response — so it vanished the moment
  // the browser tab closed. Nullable: a resume can exist before its first
  // analysis. Set together, always for the same analyze call.
  lastJdId: uuid("last_jd_id").references(() => jobDescriptions.id),
  lastGapAnalysisJson: jsonb("last_gap_analysis_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobDescriptions = pgTable("job_descriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rawText: text("raw_text").notNull(),
  parsedJson: jsonb("parsed_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Interview
// ---------------------------------------------------------------------------

export const interviewStatusEnum = pgEnum("interview_status", [
  "planned",
  "in_progress",
  "completed",
  "abandoned",
]);

export const interviewDifficultyEnum = pgEnum("interview_difficulty", [
  "easy",
  "medium",
  "hard",
]);

export const interviewTypeEnum = pgEnum("interview_type", [
  "technical",
  "resume",
  "experience",
  "hr",
  "mixed",
]);

export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  resumeId: uuid("resume_id")
    .notNull()
    .references(() => resumes.id),
  // Nullable — a job description is optional per the resume/JD flow (see
  // dashboard InterviewSetup); an interview can be resume-only.
  jdId: uuid("jd_id").references(() => jobDescriptions.id),
  durationMinutes: integer("duration_minutes").notNull(),
  difficulty: interviewDifficultyEnum("difficulty").notNull().default("medium"),
  type: interviewTypeEnum("type").notNull().default("mixed"),
  // Free-text guidance from the candidate — e.g. "go easy on system design,
  // focus on behavioral". Threaded into both planning and every turn.
  customInstructions: text("custom_instructions"),
  status: interviewStatusEnum("status").notNull().default("planned"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Persists orchestrator live state so a dropped WebSocket can resume instead
// of losing the interview. See LLD Section 6/7.
export const interviewStates = pgTable("interview_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .unique()
    .references(() => interviews.id, { onDelete: "cascade" }),
  currentQuestionId: uuid("current_question_id"),
  remainingTimeSeconds: integer("remaining_time_seconds").notNull(),
  coveredTopics: jsonb("covered_topics").notNull().default([]),
  weakTopics: jsonb("weak_topics").notNull().default([]),
  // The Planner's topic skeleton — [{ topic, difficulty, guidance }, ...] —
  // plus where the orchestrator is in it. Follow-up count is capped
  // orchestrator-side to stop a topic from looping forever.
  plannedTopics: jsonb("planned_topics").notNull().default([]),
  currentTopicIndex: integer("current_topic_index").notNull().default(0),
  followUpsOnCurrentTopic: integer("follow_ups_on_current_topic").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Questions & Answers
// ---------------------------------------------------------------------------

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviews.id, { onDelete: "cascade" }),
  // Self-relation: represents a follow-up thread off a parent question.
  // Previously missing in v1 — "dynamic follow-up questions" had nowhere to
  // be represented as a tree. See LLD Section 13.
  parentQuestionId: uuid("parent_question_id"),
  topic: text("topic").notNull(),
  difficulty: interviewDifficultyEnum("difficulty").notNull(),
  question: text("question").notNull(),
  order: integer("order").notNull(),
  askedAt: timestamp("asked_at", { withTimezone: true }),
});

export const answers = pgTable("answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  transcript: text("transcript"),
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Replaces a single flat Answer.score — the Evaluation Agent produces five
// sub-scores per answer, not one number. See LLD Section 13.
export const evaluations = pgTable("evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  answerId: uuid("answer_id")
    .notNull()
    .unique()
    .references(() => answers.id, { onDelete: "cascade" }),
  technicalScore: integer("technical_score"),
  communicationScore: integer("communication_score"),
  completenessScore: integer("completeness_score"),
  confidenceScore: integer("confidence_score"),
  problemSolvingScore: integer("problem_solving_score"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .unique()
    .references(() => interviews.id, { onDelete: "cascade" }),
  status: reportStatusEnum("status").notNull().default("pending"),
  technicalScore: integer("technical_score"),
  communicationScore: integer("communication_score"),
  recommendation: text("recommendation"),
  studyRoadmap: jsonb("study_roadmap"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  resumes: many(resumes),
  jobDescriptions: many(jobDescriptions),
  interviews: many(interviews),
}));

export const resumesRelations = relations(resumes, ({ one, many }) => ({
  user: one(users, { fields: [resumes.userId], references: [users.id] }),
  interviews: many(interviews),
}));

export const jobDescriptionsRelations = relations(jobDescriptions, ({ one, many }) => ({
  user: one(users, { fields: [jobDescriptions.userId], references: [users.id] }),
  interviews: many(interviews),
}));

export const interviewsRelations = relations(interviews, ({ one, many }) => ({
  user: one(users, { fields: [interviews.userId], references: [users.id] }),
  resume: one(resumes, { fields: [interviews.resumeId], references: [resumes.id] }),
  jobDescription: one(jobDescriptions, { fields: [interviews.jdId], references: [jobDescriptions.id] }),
  state: one(interviewStates, {
    fields: [interviews.id],
    references: [interviewStates.interviewId],
  }),
  questions: many(questions),
  report: one(reports, { fields: [interviews.id], references: [reports.interviewId] }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  interview: one(interviews, { fields: [questions.interviewId], references: [interviews.id] }),
  parentQuestion: one(questions, {
    fields: [questions.parentQuestionId],
    references: [questions.id],
    relationName: "followUps",
  }),
  followUps: many(questions, { relationName: "followUps" }),
  answer: one(answers, { fields: [questions.id], references: [answers.questionId] }),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
  evaluation: one(evaluations, { fields: [answers.id], references: [evaluations.answerId] }),
}));
