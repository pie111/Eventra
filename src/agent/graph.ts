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
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { AGENT_SYSTEM_PROMPT } from "./prompts";

// PostgresSaver — persists conversation state to the database
let checkpointer: PostgresSaver | null = null;

/**
 * Get or create the PostgresSaver checkpointer.
 * Lazily initialized and sets up required tables on first call.
 */
async function getCheckpointer(): Promise<PostgresSaver> {
    if (checkpointer) return checkpointer;

    const dbUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5432/eventra";
    checkpointer = PostgresSaver.fromConnString(dbUrl);
    await checkpointer.setup();
    console.log("✅ PostgresSaver checkpointer ready — threads persist across restarts");

    return checkpointer;
}

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
 *
 * Compiled with a MemorySaver checkpointer so conversation state is
 * persisted per thread_id across multiple invocations.
 */
export async function buildAgentGraph(config: AgentGraphConfig) {
    const { chatModel, tools, systemPrompt } = config;

    // Bind tools to the chat model — this enables function calling
    if (!chatModel.bindTools) {
        throw new Error("The selected chat model does not support tool calling. Please use a model that supports function calling.");
    }
    const modelWithTools = chatModel.bindTools(tools);

    // ─── Agent Node ───────────────────────────────────────────
    async function agentNode(state: typeof MessagesAnnotation.State) {
        const messages = state.messages;

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
    const toolNode = new ToolNode(tools);

    // ─── Routing Function ─────────────────────────────────────
    function shouldContinue(state: typeof MessagesAnnotation.State): "tools" | typeof END {
        const lastMessage = state.messages[state.messages.length - 1];

        if (
            lastMessage &&
            lastMessage._getType() === "ai" &&
            (lastMessage as AIMessage).tool_calls?.length
        ) {
            return "tools";
        }

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

    // Compile WITH checkpointer — enables thread-based persistence
    const saver = await getCheckpointer();
    return graph.compile({ checkpointer: saver });
}

// ─── Helper Types ─────────────────────────────────────────────

export type AgentGraph = Awaited<ReturnType<typeof buildAgentGraph>>;

export { HumanMessage, AIMessage, SystemMessage };
