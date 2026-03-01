// ─── LLM Service ──────────────────────────────────────────────
// Business logic for managing the LLM engine and persisting config.

import { LLMEngine } from "../llm/engine";
import { PROVIDER_REGISTRY } from "../llm/provider-registry";
import type { LLMProviderConfig } from "../llm/types";
import { getDb } from "../db/connection";
import { ConfigStore } from "../db/config-store";

let currentConfig: LLMProviderConfig | null = null;
let engine: LLMEngine | null = null;
let configLoaded = false;

// ─── Internal ─────────────────────────────────────────────────

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
        console.warn("⚠️  Could not load saved LLM config:", err instanceof Error ? err.message : err);
    }
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Get the current LLM engine, auto-loading from DB on first call.
 */
export async function getLLMEngine(): Promise<LLMEngine | null> {
    await ensureConfigLoaded();
    return engine;
}

/**
 * Get the current config (without the API key).
 */
export function getCurrentConfig(): LLMProviderConfig | null {
    return currentConfig;
}

/**
 * List all supported providers.
 */
export function listProviders() {
    return PROVIDER_REGISTRY;
}

/**
 * Validate and apply a new LLM config.
 * Persists to the database with encrypted API key.
 */
export async function configureProvider(
    config: LLMProviderConfig,
): Promise<{ provider: string; model: string; message: string }> {
    const providerInfo = PROVIDER_REGISTRY.find((p) => p.id === config.provider);
    if (!providerInfo) {
        throw new ConfigError("INVALID_PROVIDER", `Unsupported provider: "${config.provider}". Use GET /llm/providers for the list.`);
    }

    if (providerInfo.requiresApiKey && !config.apiKey) {
        throw new ConfigError("API_KEY_REQUIRED", `Provider "${config.provider}" requires an API key.`);
    }

    // Defaults for Ollama
    if (config.provider === "ollama" && !config.baseUrl) {
        config.baseUrl = providerInfo.defaultBaseUrl;
    }

    // Create or reconfigure
    if (engine) {
        engine.reconfigure(config);
    } else {
        engine = new LLMEngine(config);
    }
    currentConfig = config;

    // Persist to DB
    try {
        const db = getDb();
        const configStore = new ConfigStore(db);
        await configStore.saveConfig(config);
    } catch (dbErr) {
        console.warn("⚠️  Could not persist LLM config to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
    }

    return {
        provider: config.provider,
        model: config.model,
        message: `LLM configured: ${providerInfo.name} / ${config.model}`,
    };
}

/**
 * Test the current LLM configuration.
 */
export async function testConnection(customPrompt?: string): Promise<{
    provider: string;
    model: string;
    response: string;
    latencyMs: number;
}> {
    if (!engine || !currentConfig) {
        throw new ConfigError("NOT_CONFIGURED", "LLM not configured. Use PUT /llm/config first.");
    }

    const startTime = Date.now();

    let response: string;
    if (customPrompt) {
        const result = await engine.generateText(customPrompt, {
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

    return {
        provider: currentConfig.provider,
        model: currentConfig.model,
        response,
        latencyMs: Date.now() - startTime,
    };
}

// ─── Error Type ───────────────────────────────────────────────

export class ConfigError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = "ConfigError";
    }
}
