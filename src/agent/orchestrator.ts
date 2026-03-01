// ─── Agent Orchestrator ───────────────────────────────────────
// High-level orchestrator that ties together:
//   - LLMProviderConfig → LangChain ChatModel
//   - ToolRegistry → LangGraph DynamicStructuredTools
//   - LangGraph StateGraph → Agent with tool calling

import type { LLMProviderConfig } from "../llm/types";
import type { ToolRegistry } from "../tools/registry";
import { HumanMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createChatModel } from "./chat-model-factory";
import { buildAgentGraph, type AgentGraph } from "./graph";

// ─── Response Type ────────────────────────────────────────────

export interface OrchestratorResponse {
    /** The agent's final text response */
    response: string;
    /** All messages in the conversation (for multi-turn) */
    messages: BaseMessage[];
    /** Tool calls made during this invocation */
    toolCalls: Array<{
        toolName: string;
        args: Record<string, unknown>;
        result: string;
    }>;
}

// ─── Orchestrator Class ───────────────────────────────────────

/**
 * The Agent Orchestrator — the "brain" of Eventra.
 *
 * Usage:
 *   const orchestrator = new AgentOrchestrator(providerConfig, toolRegistry);
 *   const response = await orchestrator.invoke("What's the weather in Tokyo?");
 */
export class AgentOrchestrator {
    private graphPromise: Promise<AgentGraph>;
    private config: LLMProviderConfig;

    constructor(config: LLMProviderConfig, toolRegistry: ToolRegistry) {
        this.config = config;
        const chatModel = createChatModel(config);
        const tools = toolRegistry.getAll();
        // buildAgentGraph is async (sets up PostgresSaver checkpointer), store the promise
        this.graphPromise = buildAgentGraph({ chatModel, tools });
    }

    /**
     * Reconfigure with a new LLM provider (hot-swap).
     */
    reconfigure(config: LLMProviderConfig, toolRegistry: ToolRegistry): void {
        this.config = config;
        const chatModel = createChatModel(config);
        const tools = toolRegistry.getAll();
        this.graphPromise = buildAgentGraph({ chatModel, tools });
    }

    /**
     * Invoke the agent with a user message.
     * Pass a threadId to maintain conversation context across calls.
     */
    async invoke(userMessage: string, threadId?: string): Promise<OrchestratorResponse> {
        const graph = await this.graphPromise;

        const config = threadId
            ? { configurable: { thread_id: threadId } }
            : { configurable: { thread_id: `ephemeral-${Date.now()}` } };

        const result = await graph.invoke(
            { messages: [new HumanMessage(userMessage)] },
            config,
        );

        const messages = result.messages as BaseMessage[];

        const toolCalls: OrchestratorResponse["toolCalls"] = [];
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (msg._getType() === "tool") {
                const toolMessage = msg as BaseMessage & { name?: string; content: string };
                toolCalls.push({
                    toolName: toolMessage.name ?? "unknown",
                    args: {},
                    result: typeof toolMessage.content === "string" ? toolMessage.content : JSON.stringify(toolMessage.content),
                });
            }
        }

        const lastMessage = messages[messages.length - 1];
        const response = typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);

        return { response, messages, toolCalls };
    }

    /**
     * Get the current provider configuration.
     */
    getConfig(): LLMProviderConfig {
        return { ...this.config };
    }
}
