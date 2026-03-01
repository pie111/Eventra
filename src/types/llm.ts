// ─── LLM Engine Types ─────────────────────────────────────────

import type { ExecutionType } from "./task";
import type { ToolMetadata } from "./tool";

/**
 * A message in the LLM conversation history.
 */
export interface LLMMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    /** Tool call ID (when role is "tool") */
    toolCallId?: string;
    /** Name of the tool (when role is "tool") */
    name?: string;
}

/**
 * Request payload sent to the LLM Engine.
 */
export interface LLMRequest {
    /** The user's natural language input */
    userMessage: string;
    /** Conversation history for multi-turn context */
    conversationHistory?: LLMMessage[];
    /** Available tools the LLM can choose from */
    availableTools?: ToolMetadata[];
    /** System prompt override */
    systemPrompt?: string;
    /** Temperature for generation (0-2) */
    temperature?: number;
    /** Maximum tokens to generate */
    maxTokens?: number;
}

/**
 * The LLM's structured interpretation of user intent.
 */
export interface IntentClassification {
    /** Whether to execute immediately or create a persistent task */
    executionType: ExecutionType;
    /** Which tool to invoke */
    toolName: string;
    /** Extracted parameters for the tool */
    toolParams: Record<string, unknown>;
    /** Human-readable summary of what the user wants */
    summary: string;
    /** Condition for persistent tasks (e.g., "price > 200") */
    condition?: {
        description: string;
        operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
        field: string;
        value: unknown;
    };
    /** Schedule for persistent tasks */
    schedule?: {
        cron?: string;
        intervalMs?: number;
    };
    /** Confidence score (0-1) of the classification */
    confidence: number;
}

/**
 * Response from the LLM Engine.
 */
export interface LLMResponse {
    /** The raw text response from the LLM */
    textResponse: string;
    /** Structured intent classification (if applicable) */
    intent?: IntentClassification;
    /** Token usage for tracking costs */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
