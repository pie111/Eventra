// ─── LLM Configuration Routes ─────────────────────────────────
// Endpoints for configuring and testing the LLM provider.
// Config is persisted to PostgreSQL with AES-256-GCM encrypted API keys.

import type { FastifyInstance } from "fastify";
import { LLMEngine } from "../../llm/engine";
import { PROVIDER_REGISTRY } from "../../llm/provider-registry";
import type { LLMProviderConfig } from "../../llm/types";
import { getDb } from "../../db/connection";
import { ConfigStore } from "../../db/config-store";

let currentConfig: LLMProviderConfig | null = null;
let engine: LLMEngine | null = null;
let configLoaded = false;

/**
 * Try to load a previously saved config from the database.
 * Called once on first access to auto-restore the last config.
 */
async function ensureConfigLoaded(): Promise<void> {
    if (configLoaded) return;
    configLoaded = true;

    try {
        const db = getDb();
        const configStore = new ConfigStore(db);
        const saved = await configStore.loadConfig();

        if (saved) {
            engine = new LLMEngine(saved);
            currentConfig = saved;
            console.log(`🔑 Loaded saved LLM config: ${saved.provider} / ${saved.model}`);
        }
    } catch (err) {
        // DB might not be available yet — that's fine, user can configure later
        console.warn("⚠️  Could not load saved LLM config:", err instanceof Error ? err.message : err);
    }
}

/**
 * Get the current LLMEngine instance (used by other routes).
 * Auto-loads saved config from DB on first call.
 */
export async function getLLMEngine(): Promise<LLMEngine | null> {
    await ensureConfigLoaded();
    return engine;
}

export async function llmConfigRoutes(app: FastifyInstance) {
    // GET /llm/providers — list all supported providers
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
                data: PROVIDER_REGISTRY,
                timestamp: new Date().toISOString(),
            });
        },
    );

    // GET /llm/config — get current LLM configuration
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
            if (!currentConfig) {
                return reply.send({
                    success: true,
                    data: { configured: false },
                    timestamp: new Date().toISOString(),
                });
            }

            // Don't expose the API key in the response
            return reply.send({
                success: true,
                data: {
                    provider: currentConfig.provider,
                    model: currentConfig.model,
                    baseUrl: currentConfig.baseUrl,
                    temperature: currentConfig.temperature,
                    maxTokens: currentConfig.maxTokens,
                    configured: true,
                },
                timestamp: new Date().toISOString(),
            });
        },
    );

    // PUT /llm/config — update LLM configuration
    app.put(
        "/llm/config",
        {
            schema: {
                tags: ["LLM"],
                summary: "Configure LLM provider",
                description:
                    "Set or update the LLM provider configuration. " +
                    "This takes effect immediately for all subsequent requests.",
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
            const body = request.body as LLMProviderConfig;

            // Validate provider
            const providerInfo = PROVIDER_REGISTRY.find((p) => p.id === body.provider);
            if (!providerInfo) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "INVALID_PROVIDER",
                        message: `Unsupported provider: "${body.provider}". Use GET /llm/providers for the list.`,
                    },
                    timestamp: new Date().toISOString(),
                });
            }

            // Validate API key requirement
            if (providerInfo.requiresApiKey && !body.apiKey) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "API_KEY_REQUIRED",
                        message: `Provider "${body.provider}" requires an API key.`,
                    },
                    timestamp: new Date().toISOString(),
                });
            }

            // Set defaults for Ollama
            if (body.provider === "ollama" && !body.baseUrl) {
                body.baseUrl = providerInfo.defaultBaseUrl;
            }

            try {
                // Create or reconfigure the engine
                if (engine) {
                    engine.reconfigure(body);
                } else {
                    engine = new LLMEngine(body);
                }
                currentConfig = body;

                // Persist to database (API key will be encrypted)
                try {
                    const db = getDb();
                    const configStore = new ConfigStore(db);
                    await configStore.saveConfig(body);
                } catch (dbErr) {
                    // Non-fatal — config works in-memory even if DB save fails
                    console.warn("⚠️  Could not persist LLM config to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
                }

                return reply.send({
                    success: true,
                    data: {
                        provider: body.provider,
                        model: body.model,
                        message: `LLM configured: ${providerInfo.name} / ${body.model}`,
                    },
                    timestamp: new Date().toISOString(),
                });
            } catch (err) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "CONFIG_ERROR",
                        message: err instanceof Error ? err.message : String(err),
                    },
                    timestamp: new Date().toISOString(),
                });
            }
        },
    );

    // POST /llm/test — test the current LLM configuration
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
                            description: 'Optional custom test prompt. Defaults to a simple greeting test.',
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
            if (!engine || !currentConfig) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "NOT_CONFIGURED",
                        message: "LLM not configured. Use PUT /llm/config first.",
                    },
                    timestamp: new Date().toISOString(),
                });
            }

            const body = (request.body as { prompt?: string }) ?? {};
            const startTime = Date.now();

            try {
                let response: string;
                if (body.prompt) {
                    const result = await engine.generateText(body.prompt, {
                        temperature: 0.3,
                        maxTokens: 200,
                    });
                    response = result.text;
                } else {
                    const result = await engine.testConnection();
                    if (!result.success) {
                        throw new Error(result.error);
                    }
                    response = result.response ?? "";
                }

                return reply.send({
                    success: true,
                    data: {
                        provider: currentConfig.provider,
                        model: currentConfig.model,
                        response,
                        latencyMs: Date.now() - startTime,
                    },
                    timestamp: new Date().toISOString(),
                });
            } catch (err) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "LLM_ERROR",
                        message: err instanceof Error ? err.message : String(err),
                    },
                    timestamp: new Date().toISOString(),
                });
            }
        },
    );
}
