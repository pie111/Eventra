// ─── Tool Routes ──────────────────────────────────────────────
// Thin controller — delegates to tool-service for business logic.

import type { FastifyInstance } from "fastify";
import { listTools, getToolMetadata, listToolNames, executeTool } from "../../services/tool-service";

// Re-export for other modules that need the registry
export { getToolRegistry } from "../../services/tool-service";

export async function toolRoutes(app: FastifyInstance) {
    // GET /tools
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
            const { tools, count } = listTools();
            return reply.send({
                success: true,
                data: tools,
                count,
                timestamp: new Date().toISOString(),
            });
        },
    );

    // GET /tools/:name
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
            const metadata = getToolMetadata(name);

            if (!metadata) {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "TOOL_NOT_FOUND",
                        message: `Tool "${name}" not found. Available: ${listToolNames().join(", ")}`,
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

    // POST /tools/:name/execute
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

            const result = await executeTool(name, body.params ?? {}) as any;

            if (!result.success) {
                return reply.status(result.code === "TOOL_NOT_FOUND" ? 404 : 400).send({
                    success: false,
                    error: { code: result.code ?? "TOOL_ERROR", message: result.error },
                    timestamp: new Date().toISOString(),
                });
            }

            return reply.send({
                success: true,
                data: { toolName: name, result: result.data, executionTimeMs: result.executionTimeMs },
                timestamp: new Date().toISOString(),
            });
        },
    );
}
