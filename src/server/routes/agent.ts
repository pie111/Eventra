// ─── Agent Routes ─────────────────────────────────────────────
// Thin controller — delegates to agent-service for business logic.

import type { FastifyInstance } from "fastify";
import { processAgentMessage, AgentError } from "../../services/agent-service";

export async function agentRoutes(app: FastifyInstance) {
    // POST /agent/message
    app.post(
        "/agent/message",
        {
            schema: {
                tags: ["Agent"],
                summary: "Send a message to the agent",
                description:
                    "Processes a natural language message through the LangGraph orchestrator. " +
                    "The agent uses the configured LLM and available tools to generate a response.",
                body: {
                    type: "object",
                    required: ["message"],
                    properties: {
                        message: {
                            type: "string",
                            description: "Natural language message from the user",
                        },
                        threadId: {
                            type: "string",
                            description: "Optional. Thread ID for conversation context. Reuse the same ID for multi-turn. Auto-generated if omitted.",
                        },
                        provider: {
                            type: "string",
                            enum: ["openai", "anthropic", "google", "mistral", "ollama"],
                            description: "Optional. Override the LLM provider for this request.",
                        },
                        model: {
                            type: "string",
                            description: 'Optional. Override the model (e.g., "gpt-4o", "claude-sonnet-4-20250514").',
                        },
                        apiKey: {
                            type: "string",
                            description: "Optional. API key for the overridden provider.",
                        },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: {
                                type: "object",
                                properties: {
                                    response: { type: "string" },
                                    threadId: { type: "string" },
                                    toolCalls: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                toolName: { type: "string" },
                                                result: { type: "string" },
                                            },
                                        },
                                    },
                                    provider: { type: "string" },
                                    model: { type: "string" },
                                },
                            },
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                    400: {
                        type: "object",
                        properties: {
                            success: { type: "boolean", enum: [false] },
                            error: {
                                type: "object",
                                properties: {
                                    code: { type: "string" },
                                    message: { type: "string" },
                                },
                            },
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            try {
                const body = request.body as {
                    message: string;
                    threadId?: string;
                    provider?: string;
                    model?: string;
                    apiKey?: string;
                };

                const result = await processAgentMessage(body);

                return reply.send({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                });
            } catch (err) {
                const code = err instanceof AgentError ? err.code : "AGENT_ERROR";
                return reply.status(400).send({
                    success: false,
                    error: { code, message: err instanceof Error ? err.message : String(err) },
                    timestamp: new Date().toISOString(),
                });
            }
        },
    );
}
