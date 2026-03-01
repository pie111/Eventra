// ─── Chat Model Factory ───────────────────────────────────────
// Maps our LLMProviderConfig → LangChain BaseChatModel
// This bridges our provider-agnostic config with LangGraph's chat models.

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatMistralAI } from "@langchain/mistralai";
import type { LLMProviderConfig } from "../llm/types";

/**
 * Creates a LangChain BaseChatModel from our provider config.
 * These models support .bindTools() for LangGraph tool calling.
 */
export function createChatModel(config: LLMProviderConfig): BaseChatModel {
    const { provider, apiKey, model, baseUrl, temperature = 0.7, maxTokens } = config;

    switch (provider) {
        case "openai":
            return new ChatOpenAI({
                openAIApiKey: apiKey,
                modelName: model,
                temperature,
                maxTokens,
                ...(baseUrl && { configuration: { baseURL: baseUrl } }),
            });

        case "anthropic":
            return new ChatAnthropic({
                anthropicApiKey: apiKey,
                modelName: model,
                temperature,
                maxTokens,
            });

        case "google":
            return new ChatGoogleGenerativeAI({
                apiKey,
                model,
                temperature,
                maxOutputTokens: maxTokens,
            });

        case "mistral":
            return new ChatMistralAI({
                apiKey,
                model,
                temperature,
                maxTokens,
            });

        case "ollama":
            // Ollama is OpenAI-compatible
            return new ChatOpenAI({
                openAIApiKey: "ollama",
                modelName: model,
                temperature,
                maxTokens,
                configuration: {
                    baseURL: baseUrl ?? "http://localhost:11434/v1",
                },
            });

        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}
