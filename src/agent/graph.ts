// ─── Agent Graph ──────────────────────────────────────────────
// LangGraph StateGraph with custom nodes for the Eventra orchestrator.
//
// Graph flow:
//   User Message → Agent (LLM + bound tools) → [Conditional]
//     ├── Has tool calls → Tool Execution → Agent (loop back)
//     └── No tool calls (final response) → END

import { StateGraph, MessagesAnnotation, END, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { AGENT_SYSTEM_PROMPT } from "./prompts";

// ─── Graph Builder ────────────────────────────────────────────

export interface AgentGraphConfig {
    /** LangChain chat model (created via createChatModel) */
    chatModel: BaseChatModel;
    /** LangGraph-native tools from our Tool Registry */
    tools: DynamicStructuredTool[];
    /** Optional system prompt override */
    systemPrompt?: string;
}

/**
 * Builds the LangGraph agent graph.
 *
 * This graph implements the ReAct pattern:
 * 1. **Agent Node**: LLM with tools bound — decides what to do
 * 2. **Tool Node**: Executes the tool calls from the agent
 * 3. **Conditional Edge**: Routes back to agent (if tool calls) or ends (if final response)
 */
export function buildAgentGraph(config: AgentGraphConfig) {
    const { chatModel, tools, systemPrompt } = config;

    // Bind tools to the chat model — this enables function calling
    if (!chatModel.bindTools) {
        throw new Error("The selected chat model does not support tool calling. Please use a model that supports function calling.");
    }
    const modelWithTools = chatModel.bindTools(tools);

    // ─── Agent Node ───────────────────────────────────────────
    // The LLM processes the conversation and decides whether to
    // call a tool or respond directly.
    async function agentNode(state: typeof MessagesAnnotation.State) {
        const messages = state.messages;

        // Prepend system prompt if messages don't already have one
        const hasSystemMessage = messages.some(
            (m: BaseMessage) => m._getType() === "system",
        );

        const input = hasSystemMessage
            ? messages
            : [new SystemMessage(systemPrompt ?? AGENT_SYSTEM_PROMPT), ...messages];

        const response = await modelWithTools.invoke(input);
        return { messages: [response] };
    }

    // ─── Tool Node ────────────────────────────────────────────
    // Executes all tool calls from the agent's response.
    const toolNode = new ToolNode(tools);

    // ─── Routing Function ─────────────────────────────────────
    // Determines whether the agent should call tools or end.
    function shouldContinue(state: typeof MessagesAnnotation.State): "tools" | typeof END {
        const lastMessage = state.messages[state.messages.length - 1];

        // If the LLM made tool calls, route to the tool node
        if (
            lastMessage &&
            lastMessage._getType() === "ai" &&
            (lastMessage as AIMessage).tool_calls?.length
        ) {
            return "tools";
        }

        // Otherwise, the response is final
        return END;
    }

    // ─── Build the Graph ──────────────────────────────────────
    const graph = new StateGraph(MessagesAnnotation)
        .addNode("agent", agentNode)
        .addNode("tools", toolNode)
        .addEdge(START, "agent")
        .addConditionalEdges("agent", shouldContinue, {
            tools: "tools",
            [END]: END,
        })
        .addEdge("tools", "agent");

    return graph.compile();
}

// ─── Helper Types ─────────────────────────────────────────────

export type AgentGraph = ReturnType<typeof buildAgentGraph>;

export { HumanMessage, AIMessage, SystemMessage };
