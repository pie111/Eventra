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
    private graph: AgentGraph;
    private config: LLMProviderConfig;

    constructor(config: LLMProviderConfig, toolRegistry: ToolRegistry) {
        this.config = config;
        const chatModel = createChatModel(config);
        const tools = toolRegistry.getAll();
        this.graph = buildAgentGraph({ chatModel, tools });
    }

    /**
     * Reconfigure with a new LLM provider (hot-swap).
     */
    reconfigure(config: LLMProviderConfig, toolRegistry: ToolRegistry): void {
        this.config = config;
        const chatModel = createChatModel(config);
        const tools = toolRegistry.getAll();
        this.graph = buildAgentGraph({ chatModel, tools });
    }

    /**
     * Invoke the agent with a user message.
     * Returns the final response along with any tool calls made.
     */
    async invoke(userMessage: string): Promise<OrchestratorResponse> {
        const result = await this.graph.invoke({
            messages: [new HumanMessage(userMessage)],
        });

        const messages = result.messages as BaseMessage[];

        // Extract tool calls from the conversation
        const toolCalls: OrchestratorResponse["toolCalls"] = [];
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (msg._getType() === "tool") {
                // Find the preceding AI message to get the tool name
                const toolMessage = msg as BaseMessage & { name?: string; content: string };
                toolCalls.push({
                    toolName: toolMessage.name ?? "unknown",
                    args: {},
                    result: typeof toolMessage.content === "string" ? toolMessage.content : JSON.stringify(toolMessage.content),
                });
            }
        }

        // The last message is the agent's final response
        const lastMessage = messages[messages.length - 1];
        const response = typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);

        return { response, messages, toolCalls };
    }

    /**
     * Invoke with full conversation history (multi-turn).
     */
    async invokeWithHistory(
        userMessage: string,
        history: BaseMessage[],
    ): Promise<OrchestratorResponse> {
        const result = await this.graph.invoke({
            messages: [...history, new HumanMessage(userMessage)],
        });

        const messages = result.messages as BaseMessage[];

        const toolCalls: OrchestratorResponse["toolCalls"] = [];
        for (const msg of messages) {
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
