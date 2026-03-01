// ─── Tool Registry ────────────────────────────────────────────
// Central registry that manages LangGraph-compatible tools.
// Tools are defined using Zod schemas and DynamicStructuredTool.

import { DynamicStructuredTool } from "@langchain/core/tools";

/**
 * Serialisable tool metadata — extracted from DynamicStructuredTool
 * for the REST API endpoints (Swagger docs, /tools listing).
 */
export interface ToolMetadataJSON {
    name: string;
    description: string;
    schema: Record<string, unknown>;
}

/**
 * ToolRegistry — manages LangGraph-native tool registration, discovery, and execution.
 *
 * Tools are stored as DynamicStructuredTool instances, making them
 * directly usable by LangGraph without any conversion.
 *
 * Usage:
 *   const registry = new ToolRegistry();
 *   registry.register(myTool);
 *   const langGraphTools = registry.getAll(); // ready for LangGraph
 *   const result = await registry.execute("my-tool", { param: "value" });
 */
export class ToolRegistry {
    private tools: Map<string, DynamicStructuredTool> = new Map();

    /**
     * Register a LangGraph tool.
     */
    register(tool: DynamicStructuredTool): void {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool "${tool.name}" is already registered.`);
        }
        this.tools.set(tool.name, tool);
    }

    /**
     * Register multiple tools at once.
     */
    registerAll(tools: DynamicStructuredTool[]): void {
        for (const tool of tools) {
            this.register(tool);
        }
    }

    /**
     * Unregister a tool by name.
     */
    unregister(name: string): boolean {
        return this.tools.delete(name);
    }

    /**
     * Check if a tool is registered.
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Get a tool by name — returns the LangGraph DynamicStructuredTool directly.
     */
    get(name: string): DynamicStructuredTool | undefined {
        return this.tools.get(name);
    }

    /**
     * Get all tools as an array — ready to pass directly to LangGraph.
     */
    getAll(): DynamicStructuredTool[] {
        return Array.from(this.tools.values());
    }

    /**
     * List all tool names.
     */
    listNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Get JSON-serialisable metadata for all tools.
     * Used by the REST API to expose tool info without the execute function.
     */
    getAllMetadata(): ToolMetadataJSON[] {
        return this.getAll().map((tool) => ({
            name: tool.name,
            description: tool.description,
            schema: tool.schema ? JSON.parse(JSON.stringify(tool.schema)) : {},
        }));
    }

    /**
     * Get metadata for a single tool.
     */
    getMetadata(name: string): ToolMetadataJSON | undefined {
        const tool = this.tools.get(name);
        if (!tool) return undefined;
        return {
            name: tool.name,
            description: tool.description,
            schema: tool.schema ? JSON.parse(JSON.stringify(tool.schema)) : {},
        };
    }

    /**
     * Execute a tool by name with the given params.
     */
    async execute(
        name: string,
        params: Record<string, unknown>,
    ): Promise<{ success: boolean; data?: unknown; error?: string; executionTimeMs?: number }> {
        const tool = this.tools.get(name);
        if (!tool) {
            return {
                success: false,
                error: `Tool "${name}" not found. Available: ${this.listNames().join(", ")}`,
            };
        }

        const startTime = Date.now();
        try {
            const result = await tool.invoke(params);

            // DynamicStructuredTool returns a string — parse if JSON
            let data: unknown;
            try {
                data = JSON.parse(result as string);
            } catch {
                data = result;
            }

            return {
                success: true,
                data,
                executionTimeMs: Date.now() - startTime,
            };
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
                executionTimeMs: Date.now() - startTime,
            };
        }
    }

    /**
     * Total number of registered tools.
     */
    get size(): number {
        return this.tools.size;
    }
}
