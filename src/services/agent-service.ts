// ─── Agent Service ────────────────────────────────────────────
// Business logic for the agent orchestrator.

import { AgentOrchestrator } from "../agent/orchestrator";
import type { LLMProviderConfig } from "../llm/types";
import type { ToolRegistry } from "../tools/registry";
import { getLLMEngine } from "./llm-service";
import { getToolRegistry } from "./tool-service";

// Default orchestrator — reused across requests with the same config
let defaultOrchestrator: AgentOrchestrator | null = null;
let lastConfigKey = "";

export interface AgentMessageInput {
    message: string;
    threadId?: string;
    provider?: string;
    model?: string;
    apiKey?: string;
}

export interface AgentMessageResult {
    response: string;
    threadId: string;
    toolCalls: Array<{ toolName: string; result: string }>;
    provider: string;
    model: string;
}

/**
 * Process a user message through the LangGraph agent.
 * Supports optional per-request model/provider overrides.
 */
export async function processAgentMessage(input: AgentMessageInput): Promise<AgentMessageResult> {
    const engine = await getLLMEngine();
    const hasOverride = input.provider || input.model;

    if (!engine && !hasOverride) {
        throw new AgentError(
            "LLM_NOT_CONFIGURED",
            "LLM not configured. Use PUT /llm/config first, or pass provider/model/apiKey in the request body.",
        );
    }

    const registry = getToolRegistry();
    let activeOrchestrator: AgentOrchestrator;
    let activeConfig: LLMProviderConfig;

    if (hasOverride) {
        // Build a per-request config by merging overrides with the saved config
        const baseConfig = engine?.getConfig();
        activeConfig = {
            provider: (input.provider ?? baseConfig?.provider ?? "openai") as LLMProviderConfig["provider"],
            model: input.model ?? baseConfig?.model ?? "gpt-4o",
            apiKey: input.apiKey ?? baseConfig?.apiKey,
            baseUrl: baseConfig?.baseUrl,
            temperature: baseConfig?.temperature,
            maxTokens: baseConfig?.maxTokens,
        };
        activeOrchestrator = new AgentOrchestrator(activeConfig, registry);
    } else {
        // Use the default saved config
        activeConfig = engine!.getConfig();
        const configKey = `${activeConfig.provider}:${activeConfig.model}`;

        if (!defaultOrchestrator || configKey !== lastConfigKey) {
            defaultOrchestrator = new AgentOrchestrator(activeConfig, registry);
            lastConfigKey = configKey;
        }
        activeOrchestrator = defaultOrchestrator;
    }

    // Thread ID for conversation persistence — auto-generate if not provided
    const threadId = input.threadId ?? `thread-${Date.now()}`;

    const result = await activeOrchestrator.invoke(input.message, threadId);

    return {
        response: result.response,
        threadId,
        toolCalls: result.toolCalls.map((tc: { toolName: string; result: string }) => ({
            toolName: tc.toolName,
            result: tc.result,
        })),
        provider: activeConfig.provider,
        model: activeConfig.model,
    };
}

// ─── Error Type ───────────────────────────────────────────────

export class AgentError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = "AgentError";
    }
}
