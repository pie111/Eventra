// ─── Tool Routes ──────────────────────────────────────────────
// Endpoints for inspecting and executing registered tools.

import type { FastifyInstance } from "fastify";
import { ToolRegistry } from "../../tools/registry.js";
import { builtinTools } from "../../tools/index.js";

// Singleton registry — initialized with built-in tools
const registry = new ToolRegistry();
registry.registerAll(builtinTools);

/**
 * Get the shared ToolRegistry instance (used by other modules).
 */
export function getToolRegistry(): ToolRegistry {
    return registry;
}

export async function toolRoutes(app: FastifyInstance) {
    // GET /tools — list all registered tools
    app.get(
        "/tools",
        {
            schema: {
                tags: ["Tools"],
                summary: "List all registered tools",
                description: "Returns metadata for all LangGraph-compatible tools in the registry",
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: { type: "array" },
                            count: { type: "number" },
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                },
            },
        },
        async (_request, reply) => {
            return reply.send({
                success: true,
                data: registry.getAllMetadata(),
                count: registry.size,
                timestamp: new Date().toISOString(),
            });
        },
    );

    // GET /tools/:name — get a single tool's metadata
    app.get(
        "/tools/:name",
        {
            schema: {
                tags: ["Tools"],
                summary: "Get tool details",
                description: "Returns metadata for a specific tool including its Zod schema",
                params: {
                    type: "object",
                    required: ["name"],
                    properties: { name: { type: "string" } },
                },
            },
        },
        async (request, reply) => {
            const { name } = request.params as { name: string };
            const metadata = registry.getMetadata(name);

            if (!metadata) {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "TOOL_NOT_FOUND",
                        message: `Tool "${name}" not found. Available: ${registry.listNames().join(", ")}`,
                    },
                    timestamp: new Date().toISOString(),
                });
            }

            return reply.send({
                success: true,
                data: metadata,
                timestamp: new Date().toISOString(),
            });
        },
    );

    // POST /tools/:name/execute — manually execute a tool
    app.post(
        "/tools/:name/execute",
        {
            schema: {
                tags: ["Tools"],
                summary: "Execute a tool",
                description: "Manually execute a tool with given parameters",
                params: {
                    type: "object",
                    required: ["name"],
                    properties: { name: { type: "string" } },
                },
                body: {
                    type: "object",
                    properties: {
                        params: {
                            type: "object",
                            description: "Parameters to pass to the tool (matching its Zod schema)",
                            additionalProperties: true,
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const { name } = request.params as { name: string };
            const body = (request.body as { params?: Record<string, unknown> }) ?? {};

            if (!registry.has(name)) {
                return reply.status(404).send({
                    success: false,
                    error: { code: "TOOL_NOT_FOUND", message: `Tool "${name}" not found.` },
                    timestamp: new Date().toISOString(),
                });
            }

            const result = await registry.execute(name, body.params ?? {});

            return reply.status(result.success ? 200 : 400).send({
                success: result.success,
                data: result.success
                    ? { toolName: name, result: result.data, executionTimeMs: result.executionTimeMs }
                    : undefined,
                error: result.error ? { code: "TOOL_ERROR", message: result.error } : undefined,
                timestamp: new Date().toISOString(),
            });
        },
    );
}
