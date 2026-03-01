// ─── Provider Configuration Types ─────────────────────────────

/**
 * Supported LLM providers.
 */
export const SupportedProvider = {
    OPENAI: "openai",
    ANTHROPIC: "anthropic",
    GOOGLE: "google",
    MISTRAL: "mistral",
    OLLAMA: "ollama",
} as const;

export type SupportedProvider = (typeof SupportedProvider)[keyof typeof SupportedProvider];

/**
 * Configuration for an LLM provider — everything needed to connect.
 */
export interface LLMProviderConfig {
    /** Which provider to use */
    provider: SupportedProvider;
    /** API key (not required for Ollama) */
    apiKey?: string;
    /** Model identifier (e.g., "gpt-4o", "claude-sonnet-4-20250514", "gemini-2.0-flash") */
    model: string;
    /** Custom base URL (required for Ollama, optional for others) */
    baseUrl?: string;
    /** Default temperature (0-2) */
    temperature?: number;
    /** Default max tokens */
    maxTokens?: number;
}

/**
 * Metadata about a supported provider — shown in the /llm/providers endpoint.
 */
export interface ProviderInfo {
    id: SupportedProvider;
    name: string;
    description: string;
    requiresApiKey: boolean;
    defaultBaseUrl?: string;
    popularModels: string[];
}
