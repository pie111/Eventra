// ─── Database Schema: Tasks ──────────────────────────────────
// PostgreSQL schema for persistent monitoring tasks.

import { pgTable, text, timestamp, jsonb, integer, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────

export const taskStatusEnum = pgEnum("task_status", [
    "pending",
    "active",
    "running",
    "completed",
    "failed",
    "cancelled",
]);

export const executionTypeEnum = pgEnum("execution_type", [
    "immediate",
    "persistent",
]);

// ─── Tasks Table ──────────────────────────────────────────────

export const tasks = pgTable("tasks", {
    id: text("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    userId: text("user_id").notNull().default("default"),

    /** Original natural language request */
    description: text("description").notNull(),

    executionType: executionTypeEnum("execution_type").notNull(),
    status: taskStatusEnum("status").notNull().default("pending"),

    /** Tool to execute */
    toolName: text("tool_name").notNull(),
    toolParams: jsonb("tool_params").$type<Record<string, unknown>>().notNull().default({}),

    /** Condition for persistent tasks */
    condition: jsonb("condition").$type<{
        description: string;
        toolName: string;
        toolParams: Record<string, unknown>;
        operator: string;
        field: string;
        value: unknown;
    }>(),

    /** Schedule for persistent tasks */
    schedule: jsonb("schedule").$type<{
        cron?: string;
        intervalMs?: number;
        maxEvaluations?: number;
        expiresAt?: string;
    }>(),

    /** Last execution result */
    lastResult: jsonb("last_result"),

    /** Number of evaluations */
    evaluationCount: integer("evaluation_count").notNull().default(0),

    /** Error message if failed */
    error: text("error"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ─── Task Runs Table ──────────────────────────────────────────
// Execution history — one row per evaluation of a task.

export const taskRuns = pgTable("task_runs", {
    id: text("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    taskId: text("task_id")
        .notNull()
        .references(() => tasks.id, { onDelete: "cascade" }),

    /** Whether the condition was met in this run */
    conditionMet: integer("condition_met").notNull().default(0),

    /** Tool result data */
    result: jsonb("result"),

    /** Error if this run failed */
    error: text("error"),

    /** Execution duration in ms */
    executionTimeMs: integer("execution_time_ms"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Memory Table ─────────────────────────────────────────────
// Stores conversations and agent notes for persistent memory.

export const memory = pgTable("memory", {
    id: text("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    userId: text("user_id").notNull().default("default"),

    /** Type: "conversation", "note", "plan" */
    type: text("type").notNull(),

    /** Human-readable content */
    content: text("content").notNull(),

    /** Metadata (e.g., conversation ID, tool used, etc.) */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
