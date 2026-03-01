// ─── Tool Service ─────────────────────────────────────────────
// Business logic for the tool registry.

import { ToolRegistry } from "../tools/registry";
import { builtinTools } from "../tools/index";

// Singleton registry — initialized with built-in tools
const registry = new ToolRegistry();
registry.registerAll(builtinTools);

/**
 * Get the shared ToolRegistry instance.
 */
export function getToolRegistry(): ToolRegistry {
    return registry;
}

/**
 * List metadata for all registered tools.
 */
export function listTools() {
    return {
        tools: registry.getAllMetadata(),
        count: registry.size,
    };
}

/**
 * Get metadata for a single tool.
 * Returns null if not found.
 */
export function getToolMetadata(name: string) {
    return registry.getMetadata(name) ?? null;
}

/**
 * List all tool names (for error messages).
 */
export function listToolNames(): string[] {
    return registry.listNames();
}

/**
 * Execute a tool by name.
 */
export async function executeTool(name: string, params: Record<string, unknown>) {
    if (!registry.has(name)) {
        return { success: false, error: `Tool "${name}" not found.`, code: "TOOL_NOT_FOUND" };
    }
    return registry.execute(name, params);
}
