// ─── Provider Factory ─────────────────────────────────────────
// Creates the correct AI SDK provider instance from a user's config.

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import type { LanguageModelV1 } from "ai";
import { type LLMProviderConfig, SupportedProvider } from "./types";

/**
 * Creates an AI SDK LanguageModel from the given provider configuration.
 * This is the core abstraction — all downstream code uses the unified LanguageModelV1 interface.
 */
export function createLanguageModel(config: LLMProviderConfig): LanguageModelV1 {
    switch (config.provider) {
        case SupportedProvider.OPENAI: {
            const openai = createOpenAI({
                apiKey: config.apiKey,
                ...(config.baseUrl && { baseURL: config.baseUrl }),
            });
            return openai(config.model);
        }

        case SupportedProvider.ANTHROPIC: {
            const anthropic = createAnthropic({
                apiKey: config.apiKey,
            });
            return anthropic(config.model);
        }

        case SupportedProvider.GOOGLE: {
            const google = createGoogleGenerativeAI({
                apiKey: config.apiKey,
            });
            return google(config.model);
        }

        case SupportedProvider.MISTRAL: {
            const mistral = createMistral({
                apiKey: config.apiKey,
            });
            return mistral(config.model);
        }

        case SupportedProvider.OLLAMA: {
            // Ollama exposes an OpenAI-compatible API — reuse the OpenAI provider
            const ollama = createOpenAI({
                apiKey: "ollama", // Ollama doesn't need a real key
                baseURL: config.baseUrl ?? "http://localhost:11434/v1",
            });
            return ollama(config.model);
        }

        default:
            throw new Error(`Unsupported provider: ${config.provider}`);
    }
}
