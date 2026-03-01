// ─── Config Store ─────────────────────────────────────────────
// Database-backed store for LLM provider configuration.
// API keys are encrypted at rest using AES-256-GCM.

import { eq } from "drizzle-orm";
import { llmConfigs } from "./schema";
import { encrypt, decrypt } from "./crypto";
import type { LLMProviderConfig } from "../llm/types";
import type { Database } from "./connection";

export class ConfigStore {
    constructor(private db: Database) { }

    /**
     * Save or update the LLM config for a user.
     * The API key is encrypted before storage.
     */
    async saveConfig(config: LLMProviderConfig, userId = "default"): Promise<void> {
        const encryptedApiKey = config.apiKey ? encrypt(config.apiKey) : null;

        // Check if config already exists for this user
        const existing = await this.db
            .select({ id: llmConfigs.id })
            .from(llmConfigs)
            .where(eq(llmConfigs.userId, userId))
            .limit(1);

        const data = {
            provider: config.provider,
            model: config.model,
            encryptedApiKey,
            baseUrl: config.baseUrl ?? null,
            temperature: config.temperature != null ? String(config.temperature) : null,
            maxTokens: config.maxTokens != null ? String(config.maxTokens) : null,
            updatedAt: new Date(),
        };

        if (existing.length > 0) {
            await this.db
                .update(llmConfigs)
                .set(data)
                .where(eq(llmConfigs.userId, userId));
        } else {
            await this.db.insert(llmConfigs).values({
                userId,
                ...data,
            });
        }
    }

    /**
     * Load the LLM config for a user.
     * The API key is decrypted before returning.
     * Returns null if no config exists.
     */
    async loadConfig(userId = "default"): Promise<LLMProviderConfig | null> {
        const rows = await this.db
            .select()
            .from(llmConfigs)
            .where(eq(llmConfigs.userId, userId))
            .limit(1);

        if (rows.length === 0) return null;

        const row = rows[0];
        let apiKey: string | undefined;

        if (row.encryptedApiKey) {
            try {
                apiKey = decrypt(row.encryptedApiKey);
            } catch (err) {
                console.error("Failed to decrypt API key — config may require reconfiguration:", err);
                return null;
            }
        }

        return {
            provider: row.provider as LLMProviderConfig["provider"],
            model: row.model,
            apiKey,
            baseUrl: row.baseUrl ?? undefined,
            temperature: row.temperature != null ? parseFloat(row.temperature) : undefined,
            maxTokens: row.maxTokens != null ? parseInt(row.maxTokens, 10) : undefined,
        };
    }

    /**
     * Delete the LLM config for a user.
     */
    async deleteConfig(userId = "default"): Promise<boolean> {
        const result = await this.db
            .delete(llmConfigs)
            .where(eq(llmConfigs.userId, userId))
            .returning({ id: llmConfigs.id });
        return result.length > 0;
    }
}
