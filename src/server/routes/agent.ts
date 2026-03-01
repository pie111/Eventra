// ─── Agent Routes ─────────────────────────────────────────────
// The main agent endpoint — processes user messages through the LangGraph orchestrator.

import type { FastifyInstance } from "fastify";
import { AgentOrchestrator } from "../../agent/orchestrator";
import { getLLMEngine } from "./llm-config";
import { getToolRegistry } from "./tools";

// Singleton orchestrator — created when LLM is configured
let orchestrator: AgentOrchestrator | null = null;

export async function agentRoutes(app: FastifyInstance) {
    // POST /agent/message — send a message to the agent
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
            const { message } = request.body as { message: string };

            // Check if LLM is configured
            const engine = getLLMEngine();
            if (!engine) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "LLM_NOT_CONFIGURED",
                        message: "LLM not configured. Use PUT /llm/config first.",
                    },
                    timestamp: new Date().toISOString(),
                });
            }

            try {
                // Create or reuse the orchestrator
                const config = engine.getConfig();
                const registry = getToolRegistry();

                if (!orchestrator) {
                    orchestrator = new AgentOrchestrator(config, registry);
                }

                // Invoke the LangGraph agent
                const result = await orchestrator.invoke(message);

                return reply.send({
                    success: true,
                    data: {
                        response: result.response,
                        toolCalls: result.toolCalls.map((tc) => ({
                            toolName: tc.toolName,
                            result: tc.result,
                        })),
                        provider: config.provider,
                        model: config.model,
                    },
                    timestamp: new Date().toISOString(),
                });
            } catch (err) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "AGENT_ERROR",
                        message: err instanceof Error ? err.message : String(err),
                    },
                    timestamp: new Date().toISOString(),
                });
            }
        },
    );
}
