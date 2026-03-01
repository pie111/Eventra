// ─── LLM Engine ───────────────────────────────────────────────
// The core engine that wraps the Vercel AI SDK with Eventra-specific logic.

import { generateText, streamText, generateObject, type LanguageModelV1, type CoreMessage } from "ai";
import { z } from "zod";
import type { LLMProviderConfig } from "./types";
import type { ToolMetadata } from "../types/tool";
import { createLanguageModel } from "./factory";
import { AGENT_SYSTEM_PROMPT, INTENT_CLASSIFICATION_PROMPT } from "./prompts";

// ─── Intent Classification Schema (Zod) ──────────────────────

const IntentSchema = z.object({
    executionType: z.enum(["immediate", "persistent"]),
    toolName: z.string().describe("Name of the tool to invoke"),
    toolParams: z.record(z.unknown()).describe("Parameters for the tool"),
    summary: z.string().describe("Human-readable summary of the user's intent"),
    confidence: z.number().min(0).max(1).describe("Confidence score"),
    condition: z
        .object({
            description: z.string(),
            operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]),
            field: z.string(),
            value: z.unknown(),
        })
        .optional()
        .describe("Condition for persistent tasks"),
    schedule: z
        .object({
            cron: z.string().optional(),
            intervalMs: z.number().optional(),
        })
        .optional()
        .describe("Schedule for persistent tasks"),
});

export type ClassifiedIntent = z.infer<typeof IntentSchema>;

// ─── Chat Response Type ───────────────────────────────────────

export interface ChatResponse {
    text: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface StreamTextResponse {
    textStream: AsyncIterable<string>;
}

// ─── LLM Engine Class ────────────────────────────────────────

/**
 * Provider-agnostic LLM Engine.
 *
 * Wraps the Vercel AI SDK to provide a unified interface for:
 * - Chat (conversational)
 * - Intent classification (structured output)
 * - Text generation
 * - Streaming text generation
 *
 * Users configure which provider to use via LLMProviderConfig.
 */
export class LLMEngine {
    private model: LanguageModelV1;
    private config: LLMProviderConfig;

    constructor(config: LLMProviderConfig) {
        this.config = config;
        this.model = createLanguageModel(config);
    }

    /**
     * Get the current provider configuration.
     */
    getConfig(): LLMProviderConfig {
        return { ...this.config };
    }

    /**
     * Reconfigure the engine with a new provider (hot-swap).
     */
    reconfigure(newConfig: LLMProviderConfig): void {
        this.config = newConfig;
        this.model = createLanguageModel(newConfig);
    }

    /**
     * Chat — conversational interaction with optional system prompt.
     */
    async chat(
        messages: CoreMessage[],
        options?: { systemPrompt?: string; temperature?: number; maxTokens?: number },
    ): Promise<ChatResponse> {
        const result = await generateText({
            model: this.model,
            system: options?.systemPrompt ?? AGENT_SYSTEM_PROMPT,
            messages,
            temperature: options?.temperature ?? this.config.temperature ?? 0.7,
            maxTokens: options?.maxTokens ?? this.config.maxTokens,
        });

        return {
            text: result.text,
            usage: result.usage
                ? {
                    promptTokens: result.usage.promptTokens,
                    completionTokens: result.usage.completionTokens,
                    totalTokens: result.usage.promptTokens + result.usage.completionTokens,
                }
                : undefined,
        };
    }

    /**
     * Classify the user's intent — returns structured output.
     * Determines execution type, tool, params, and condition.
     */
    async classifyIntent(
        userMessage: string,
        availableTools: ToolMetadata[],
    ): Promise<ClassifiedIntent> {
        const toolDescriptions = availableTools
            .map(
                (t) =>
                    `- **${t.name}** (${t.category}): ${t.description}\n  Parameters: ${t.parameters.map((p) => `${p.name} (${p.type}, ${p.required ? "required" : "optional"}): ${p.description}`).join(", ")}`,
            )
            .join("\n");

        const result = await generateObject({
            model: this.model,
            schema: IntentSchema,
            system: INTENT_CLASSIFICATION_PROMPT,
            prompt: `Available tools:\n${toolDescriptions}\n\nUser message: "${userMessage}"`,
            temperature: 0.1, // Low temperature for classification
        });

        return result.object;
    }

    /**
     * Generate text — simple prompt → response.
     */
    async generateText(
        prompt: string,
        options?: { systemPrompt?: string; temperature?: number; maxTokens?: number },
    ): Promise<ChatResponse> {
        const result = await generateText({
            model: this.model,
            system: options?.systemPrompt,
            prompt,
            temperature: options?.temperature ?? this.config.temperature ?? 0.7,
            maxTokens: options?.maxTokens ?? this.config.maxTokens,
        });

        return {
            text: result.text,
            usage: result.usage
                ? {
                    promptTokens: result.usage.promptTokens,
                    completionTokens: result.usage.completionTokens,
                    totalTokens: result.usage.promptTokens + result.usage.completionTokens,
                }
                : undefined,
        };
    }

    /**
     * Stream text — returns an async iterable of text chunks.
     */
    async streamText(
        prompt: string,
        options?: { systemPrompt?: string; temperature?: number; maxTokens?: number },
    ): Promise<StreamTextResponse> {
        const result = streamText({
            model: this.model,
            system: options?.systemPrompt ?? AGENT_SYSTEM_PROMPT,
            prompt,
            temperature: options?.temperature ?? this.config.temperature ?? 0.7,
            maxTokens: options?.maxTokens ?? this.config.maxTokens,
        });

        return { textStream: result.textStream };
    }

    /**
     * Quick test — send a simple prompt to verify the provider is configured correctly.
     */
    async testConnection(): Promise<{ success: boolean; response?: string; error?: string }> {
        try {
            const result = await this.generateText("Say 'Hello from Eventra!' in exactly those words.", {
                temperature: 0,
                maxTokens: 50,
            });
            return { success: true, response: result.text };
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
}
