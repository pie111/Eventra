// ─── Provider Registry ────────────────────────────────────────
// Maps provider configs to their metadata for the /llm/providers endpoint.

import { type ProviderInfo, SupportedProvider } from "./types";

/**
 * Registry of all supported providers with their metadata.
 */
export const PROVIDER_REGISTRY: ProviderInfo[] = [
    {
        id: SupportedProvider.OPENAI,
        name: "OpenAI",
        description: "GPT-4o, GPT-4o-mini, o1, o3 and more",
        requiresApiKey: true,
        popularModels: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
    },
    {
        id: SupportedProvider.ANTHROPIC,
        name: "Anthropic",
        description: "Claude Sonnet, Opus, Haiku models",
        requiresApiKey: true,
        popularModels: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    },
    {
        id: SupportedProvider.GOOGLE,
        name: "Google",
        description: "Gemini 2.0 Flash, Pro and more",
        requiresApiKey: true,
        popularModels: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro"],
    },
    {
        id: SupportedProvider.MISTRAL,
        name: "Mistral",
        description: "Mistral Large, Medium, Small models",
        requiresApiKey: true,
        popularModels: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
    },
    {
        id: SupportedProvider.OLLAMA,
        name: "Ollama",
        description: "Run local models (Llama 3, Mistral, Phi, etc.)",
        requiresApiKey: false,
        defaultBaseUrl: "http://localhost:11434/v1",
        popularModels: ["llama3", "llama3:70b", "mistral", "phi3", "gemma2"],
    },
];
