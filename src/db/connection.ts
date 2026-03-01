// ─── Database Connection ──────────────────────────────────────
// Creates and manages the PostgreSQL connection via postgres.js + Drizzle.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

/**
 * Get the database URL from environment, with a sensible default.
 */
function getDatabaseUrl(): string {
    return process.env.DATABASE_URL ?? "postgresql://localhost:5432/eventra";
}

/**
 * Initialize or return the existing database connection.
 */
export function getDb() {
    if (!_db) {
        _client = postgres(getDatabaseUrl());
        _db = drizzle(_client, { schema });
    }
    return _db;
}

/**
 * Close the database connection cleanly (for shutdown).
 */
export async function closeDb(): Promise<void> {
    if (_client) {
        await _client.end();
        _client = null;
        _db = null;
    }
}

/**
 * Database type for use in function signatures.
 */
export type Database = ReturnType<typeof getDb>;
