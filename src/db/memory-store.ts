// ─── Memory Store ─────────────────────────────────────────────
// Service for storing and retrieving agent memory (conversations, notes, plans).

import { eq, desc } from "drizzle-orm";
import type { Database } from "./connection";
import { memory } from "./schema";

export interface CreateMemoryInput {
    userId?: string;
    type: "conversation" | "note" | "plan";
    content: string;
    metadata?: Record<string, unknown>;
}

export class MemoryStore {
    constructor(private db: Database) { }

    /**
     * Store a new memory entry.
     */
    async create(input: CreateMemoryInput) {
        const [entry] = await this.db.insert(memory).values({
            userId: input.userId ?? "default",
            type: input.type,
            content: input.content,
            metadata: input.metadata ?? {},
        }).returning();

        return entry;
    }

    /**
     * List recent memories, optionally filtered by type.
     */
    async listRecent(options?: { type?: string; limit?: number; userId?: string }) {
        const limit = options?.limit ?? 20;

        let query = this.db
            .select()
            .from(memory)
            .orderBy(desc(memory.createdAt))
            .limit(limit);

        if (options?.type) {
            query = query.where(eq(memory.type, options.type)) as typeof query;
        }

        return query;
    }

    /**
     * Get a specific memory entry.
     */
    async get(id: string) {
        const [entry] = await this.db
            .select()
            .from(memory)
            .where(eq(memory.id, id))
            .limit(1);
        return entry ?? null;
    }
}
