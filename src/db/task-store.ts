// ─── Task Store ───────────────────────────────────────────────
// CRUD service for tasks — the persistence layer for scheduled/monitored tasks.

import { eq, desc } from "drizzle-orm";
import type { Database } from "./connection";
import { tasks, taskRuns } from "./schema";

// ─── Types ────────────────────────────────────────────────────

export interface CreateTaskInput {
    userId?: string;
    description: string;
    executionType: "immediate" | "persistent";
    toolName: string;
    toolParams?: Record<string, unknown>;
    condition?: {
        description: string;
        toolName: string;
        toolParams: Record<string, unknown>;
        operator: string;
        field: string;
        value: unknown;
    };
    schedule?: {
        cron?: string;
        intervalMs?: number;
        maxEvaluations?: number;
        expiresAt?: string;
    };
}

export interface CreateTaskRunInput {
    taskId: string;
    conditionMet: boolean;
    result?: unknown;
    error?: string;
    executionTimeMs?: number;
}

// ─── Task Store Class ─────────────────────────────────────────

export class TaskStore {
    constructor(private db: Database) { }

    /**
     * Create a new task.
     */
    async createTask(input: CreateTaskInput) {
        const [task] = await this.db.insert(tasks).values({
            userId: input.userId ?? "default",
            description: input.description,
            executionType: input.executionType,
            status: input.executionType === "immediate" ? "running" : "pending",
            toolName: input.toolName,
            toolParams: input.toolParams ?? {},
            condition: input.condition,
            schedule: input.schedule,
        }).returning();

        return task;
    }

    /**
     * Get a task by ID.
     */
    async getTask(id: string) {
        const [task] = await this.db
            .select()
            .from(tasks)
            .where(eq(tasks.id, id))
            .limit(1);
        return task ?? null;
    }

    /**
     * List all tasks, most recent first.
     */
    async listTasks(limit = 50) {
        return this.db
            .select()
            .from(tasks)
            .orderBy(desc(tasks.createdAt))
            .limit(limit);
    }

    /**
     * List active persistent tasks (for the background worker to poll).
     */
    async listActiveTasks() {
        return this.db
            .select()
            .from(tasks)
            .where(eq(tasks.status, "active"));
    }

    /**
     * Update a task's status.
     */
    async updateTaskStatus(
        id: string,
        status: "pending" | "active" | "running" | "completed" | "failed" | "cancelled",
        extra?: { lastResult?: unknown; error?: string },
    ) {
        const [updated] = await this.db
            .update(tasks)
            .set({
                status,
                updatedAt: new Date(),
                ...(status === "completed" ? { completedAt: new Date() } : {}),
                ...(extra?.lastResult !== undefined ? { lastResult: extra.lastResult } : {}),
                ...(extra?.error !== undefined ? { error: extra.error } : {}),
            })
            .where(eq(tasks.id, id))
            .returning();

        return updated ?? null;
    }

    /**
     * Increment the evaluation count and record the last result.
     */
    async recordEvaluation(id: string, result: unknown) {
        const task = await this.getTask(id);
        if (!task) return null;

        const [updated] = await this.db
            .update(tasks)
            .set({
                evaluationCount: task.evaluationCount + 1,
                lastResult: result,
                updatedAt: new Date(),
            })
            .where(eq(tasks.id, id))
            .returning();

        return updated ?? null;
    }

    /**
     * Cancel a task.
     */
    async cancelTask(id: string) {
        return this.updateTaskStatus(id, "cancelled");
    }

    // ─── Task Runs ────────────────────────────────────────────

    /**
     * Record a task run (one evaluation cycle).
     */
    async createTaskRun(input: CreateTaskRunInput) {
        const [run] = await this.db.insert(taskRuns).values({
            taskId: input.taskId,
            conditionMet: input.conditionMet ? 1 : 0,
            result: input.result,
            error: input.error,
            executionTimeMs: input.executionTimeMs,
        }).returning();

        return run;
    }

    /**
     * Get runs for a task.
     */
    async getTaskRuns(taskId: string, limit = 20) {
        return this.db
            .select()
            .from(taskRuns)
            .where(eq(taskRuns.taskId, taskId))
            .orderBy(desc(taskRuns.createdAt))
            .limit(limit);
    }
}
