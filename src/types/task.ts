// ─── Task Types ───────────────────────────────────────────────

export const TaskStatus = {
    PENDING: "pending",
    ACTIVE: "active",
    RUNNING: "running",
    COMPLETED: "completed",
    FAILED: "failed",
    CANCELLED: "cancelled",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const ExecutionType = {
    IMMEDIATE: "immediate",
    PERSISTENT: "persistent",
} as const;

export type ExecutionType = (typeof ExecutionType)[keyof typeof ExecutionType];

/**
 * A condition that the Background Worker evaluates for persistent tasks.
 * e.g., "AAPL > $200" is parsed into { field: "price", operator: "gt", value: 200 }
 */
export interface TaskCondition {
    /** Human-readable description of the condition */
    description: string;
    /** The tool to call to fetch the data needed for evaluation */
    toolName: string;
    /** Parameters to pass to the tool */
    toolParams: Record<string, unknown>;
    /** Comparison operator */
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
    /** The field in the tool result to compare */
    field: string;
    /** The target value to compare against */
    value: unknown;
}

/**
 * Schedule configuration for persistent tasks.
 */
export interface TaskSchedule {
    /** Cron expression for scheduling (e.g., every 5 minutes) */
    cron?: string;
    /** Interval in milliseconds (alternative to cron) */
    intervalMs?: number;
    /** Maximum number of evaluations before auto-cancelling */
    maxEvaluations?: number;
    /** Expiry date — task auto-cancels after this */
    expiresAt?: Date;
}

/**
 * Core Task entity — represents both immediate and persistent tasks.
 */
export interface Task {
    id: string;
    userId: string;
    /** The original natural language request from the user */
    description: string;
    /** Whether this runs once or persists as a monitoring task */
    executionType: ExecutionType;
    /** Current lifecycle status */
    status: TaskStatus;
    /** The tool to execute */
    toolName: string;
    /** Parameters for the tool */
    toolParams: Record<string, unknown>;
    /** Condition to evaluate (only for persistent tasks) */
    condition?: TaskCondition;
    /** Schedule for evaluation (only for persistent tasks) */
    schedule?: TaskSchedule;
    /** Result of the last execution */
    lastResult?: unknown;
    /** Number of times this task has been evaluated */
    evaluationCount: number;
    /** Error message if the task failed */
    error?: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

/**
 * Payload for creating a new task.
 */
export type CreateTaskInput = Omit<
    Task,
    "id" | "status" | "evaluationCount" | "createdAt" | "updatedAt" | "completedAt" | "lastResult" | "error"
>;
