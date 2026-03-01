// ─── Agent Routes ─────────────────────────────────────────────
// The main agent endpoint — processes user messages through the LangGraph orchestrator.

import type { FastifyInstance } from "fastify";
import { AgentOrchestrator } from "../../agent/orchestrator";
import { getLLMEngine } from "./llm-config";
import { getToolRegistry } from "./tools";
import type { LLMProviderConfig } from "../../llm/types";

// Default orchestrator — uses the saved LLM config
let defaultOrchestrator: AgentOrchestrator | null = null;
let lastConfigKey = "";

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
                        provider: {
                            type: "string",
                            enum: ["openai", "anthropic", "google", "mistral", "ollama"],
                            description: "Optional. Override the LLM provider for this request.",
                        },
                        model: {
                            type: "string",
                            description: 'Optional. Override the model for this request (e.g., "gpt-4o", "claude-sonnet-4-20250514").',
                        },
                        apiKey: {
                            type: "string",
                            description: "Optional. API key for the overridden provider (only needed if switching providers).",
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
            const body = request.body as {
                message: string;
                provider?: string;
                model?: string;
                apiKey?: string;
            };

            // Check if LLM is configured (either via saved config or per-request override)
            const engine = await getLLMEngine();
            const hasOverride = body.provider || body.model;

            if (!engine && !hasOverride) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "LLM_NOT_CONFIGURED",
                        message:
                            "LLM not configured. Use PUT /llm/config first, " +
                            "or pass provider/model/apiKey in the request body.",
                    },
                    timestamp: new Date().toISOString(),
                });
            }

            try {
                const registry = getToolRegistry();
                let activeOrchestrator: AgentOrchestrator;
                let activeConfig: LLMProviderConfig;

                if (hasOverride) {
                    // Build a per-request config by merging overrides with the saved config
                    const baseConfig = engine?.getConfig();
                    activeConfig = {
                        provider: (body.provider ?? baseConfig?.provider ?? "openai") as LLMProviderConfig["provider"],
                        model: body.model ?? baseConfig?.model ?? "gpt-4o",
                        apiKey: body.apiKey ?? baseConfig?.apiKey,
                        baseUrl: baseConfig?.baseUrl,
                        temperature: baseConfig?.temperature,
                        maxTokens: baseConfig?.maxTokens,
                    };
                    // Create a one-off orchestrator for this override
                    activeOrchestrator = new AgentOrchestrator(activeConfig, registry);
                } else {
                    // Use the default saved config
                    activeConfig = engine!.getConfig();
                    const configKey = `${activeConfig.provider}:${activeConfig.model}`;

                    // Recreate if config changed
                    if (!defaultOrchestrator || configKey !== lastConfigKey) {
                        defaultOrchestrator = new AgentOrchestrator(activeConfig, registry);
                        lastConfigKey = configKey;
                    }
                    activeOrchestrator = defaultOrchestrator;
                }

                // Invoke the LangGraph agent
                const result = await activeOrchestrator.invoke(body.message);

                return reply.send({
                    success: true,
                    data: {
                        response: result.response,
                        toolCalls: result.toolCalls.map((tc: { toolName: string; result: string }) => ({
                            toolName: tc.toolName,
                            result: tc.result,
                        })),
                        provider: activeConfig.provider,
                        model: activeConfig.model,
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
