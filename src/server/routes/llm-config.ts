// ─── LLM Configuration Routes ─────────────────────────────────
// Thin controller — delegates to llm-service for business logic.

import type { FastifyInstance } from "fastify";
import type { LLMProviderConfig } from "../../llm/types";
import {
    listProviders,
    getCurrentConfig,
    configureProvider,
    testConnection,
    ConfigError,
} from "../../services/llm-service";

// Re-export for other routes that need the engine
export { getLLMEngine } from "../../services/llm-service";

export async function llmConfigRoutes(app: FastifyInstance) {
    // GET /llm/providers
    app.get(
        "/llm/providers",
        {
            schema: {
                tags: ["LLM"],
                summary: "List supported LLM providers",
                description:
                    "Returns all supported LLM providers with their metadata, " +
                    "including available models and whether an API key is required.",
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        name: { type: "string" },
                                        description: { type: "string" },
                                        requiresApiKey: { type: "boolean" },
                                        defaultBaseUrl: { type: "string", nullable: true },
                                        popularModels: {
                                            type: "array",
                                            items: { type: "string" },
                                        },
                                    },
                                },
                            },
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                },
            },
        },
        async (_request, reply) => {
            return reply.send({
                success: true,
                data: listProviders(),
                timestamp: new Date().toISOString(),
            });
        },
    );

    // GET /llm/config
    app.get(
        "/llm/config",
        {
            schema: {
                tags: ["LLM"],
                summary: "Get current LLM configuration",
                description: "Returns the currently configured LLM provider and model",
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: {
                                type: "object",
                                nullable: true,
                                properties: {
                                    provider: { type: "string" },
                                    model: { type: "string" },
                                    baseUrl: { type: "string", nullable: true },
                                    temperature: { type: "number", nullable: true },
                                    maxTokens: { type: "number", nullable: true },
                                    configured: { type: "boolean" },
                                },
                            },
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                },
            },
        },
        async (_request, reply) => {
            const config = getCurrentConfig();

            if (!config) {
                return reply.send({
                    success: true,
                    data: { configured: false },
                    timestamp: new Date().toISOString(),
                });
            }

            return reply.send({
                success: true,
                data: {
                    provider: config.provider,
                    model: config.model,
                    baseUrl: config.baseUrl,
                    temperature: config.temperature,
                    maxTokens: config.maxTokens,
                    configured: true,
                },
                timestamp: new Date().toISOString(),
            });
        },
    );

    // PUT /llm/config
    app.put(
        "/llm/config",
        {
            schema: {
                tags: ["LLM"],
                summary: "Configure LLM provider",
                description:
                    "Set or update the LLM provider configuration. " +
                    "Takes effect immediately for all subsequent requests.",
                body: {
                    type: "object",
                    required: ["provider", "model"],
                    properties: {
                        provider: {
                            type: "string",
                            enum: ["openai", "anthropic", "google", "mistral", "ollama"],
                            description: "LLM provider to use",
                        },
                        apiKey: {
                            type: "string",
                            description: "API key (not required for Ollama)",
                        },
                        model: {
                            type: "string",
                            description: 'Model identifier (e.g., "gpt-4o", "claude-sonnet-4-20250514")',
                        },
                        baseUrl: {
                            type: "string",
                            description: "Custom base URL (required for Ollama, optional for others)",
                        },
                        temperature: {
                            type: "number",
                            minimum: 0,
                            maximum: 2,
                            description: "Default temperature (0-2)",
                        },
                        maxTokens: {
                            type: "number",
                            minimum: 1,
                            description: "Default max tokens",
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
                                    provider: { type: "string" },
                                    model: { type: "string" },
                                    message: { type: "string" },
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
                const result = await configureProvider(request.body as LLMProviderConfig);
                return reply.send({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                });
            } catch (err) {
                const code = err instanceof ConfigError ? err.code : "CONFIG_ERROR";
                return reply.status(400).send({
                    success: false,
                    error: { code, message: err instanceof Error ? err.message : String(err) },
                    timestamp: new Date().toISOString(),
                });
            }
        },
    );

    // POST /llm/test
    app.post(
        "/llm/test",
        {
            schema: {
                tags: ["LLM"],
                summary: "Test LLM connection",
                description:
                    "Sends a simple test prompt to verify the configured LLM provider is working.",
                body: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: 'Optional custom test prompt.',
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
                                    provider: { type: "string" },
                                    model: { type: "string" },
                                    response: { type: "string" },
                                    latencyMs: { type: "number" },
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
                const body = (request.body as { prompt?: string }) ?? {};
                const result = await testConnection(body.prompt);
                return reply.send({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                });
            } catch (err) {
                const code = err instanceof ConfigError ? err.code : "LLM_ERROR";
                return reply.status(400).send({
                    success: false,
                    error: { code, message: err instanceof Error ? err.message : String(err) },
                    timestamp: new Date().toISOString(),
                });
            }
        },
    );
}
