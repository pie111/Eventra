// ─── Tool Registry Types ──────────────────────────────────────

/**
 * JSON Schema-like parameter definition for a tool.
 */
export interface ToolParameter {
    name: string;
    type: "string" | "number" | "boolean" | "object" | "array";
    description: string;
    required: boolean;
    default?: unknown;
}

/**
 * Result returned by a tool execution.
 */
export interface ToolResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    /** Execution time in milliseconds */
    executionTimeMs?: number;
}

/**
 * Definition of a tool that the LLM / Orchestrator can invoke.
 * Each tool is a self-contained unit with metadata + execute function.
 */
export interface ToolDefinition {
    /** Unique identifier for the tool */
    name: string;
    /** Human-readable description (also sent to LLM for function-calling) */
    description: string;
    /** Parameter schema for the tool */
    parameters: ToolParameter[];
    /** Category for grouping (e.g., "finance", "weather", "search") */
    category: string;
    /** The actual execution function */
    execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

/**
 * Serialisable tool metadata (without the execute function).
 * This is what gets sent to the LLM for function-calling context.
 */
export type ToolMetadata = Omit<ToolDefinition, "execute">;
