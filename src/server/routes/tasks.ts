// ─── Task Routes ──────────────────────────────────────────────
// CRUD endpoints for managing persistent tasks.

import type { FastifyInstance } from "fastify";

// Shared response schema for a single task
const taskSchema = {
    type: "object",
    properties: {
        id: { type: "string", format: "uuid" },
        userId: { type: "string" },
        description: { type: "string" },
        executionType: { type: "string", enum: ["immediate", "persistent"] },
        status: {
            type: "string",
            enum: ["pending", "active", "running", "completed", "failed", "cancelled"],
        },
        toolName: { type: "string" },
        toolParams: { type: "object" },
        condition: {
            type: "object",
            nullable: true,
            properties: {
                description: { type: "string" },
                toolName: { type: "string" },
                toolParams: { type: "object" },
                operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contains"] },
                field: { type: "string" },
                value: {},
            },
        },
        schedule: {
            type: "object",
            nullable: true,
            properties: {
                cron: { type: "string", nullable: true },
                intervalMs: { type: "number", nullable: true },
                maxEvaluations: { type: "number", nullable: true },
                expiresAt: { type: "string", format: "date-time", nullable: true },
            },
        },
        evaluationCount: { type: "number" },
        error: { type: "string", nullable: true },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        completedAt: { type: "string", format: "date-time", nullable: true },
    },
} as const;

export async function taskRoutes(app: FastifyInstance) {
    // GET /tasks — list all tasks
    app.get(
        "/tasks",
        {
            schema: {
                tags: ["Tasks"],
                summary: "List all tasks",
                description: "Retrieve all tasks, optionally filtered by status",
                querystring: {
                    type: "object",
                    properties: {
                        status: {
                            type: "string",
                            enum: ["pending", "active", "running", "completed", "failed", "cancelled"],
                            description: "Filter by task status",
                        },
                        page: { type: "integer", minimum: 1, default: 1 },
                        pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: {
                                type: "object",
                                properties: {
                                    items: { type: "array", items: taskSchema },
                                    total: { type: "number" },
                                    page: { type: "number" },
                                    pageSize: { type: "number" },
                                    hasMore: { type: "boolean" },
                                },
                            },
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            // TODO: Wire to Task Store
            return reply.send({
                success: true,
                data: {
                    items: [],
                    total: 0,
                    page: 1,
                    pageSize: 20,
                    hasMore: false,
                },
                timestamp: new Date().toISOString(),
            });
        },
    );

    // GET /tasks/:id — get a single task
    app.get(
        "/tasks/:id",
        {
            schema: {
                tags: ["Tasks"],
                summary: "Get a task by ID",
                description: "Retrieve details of a specific task",
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: { type: "string", format: "uuid" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: taskSchema,
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                    404: {
                        type: "object",
                        properties: {
                            success: { type: "boolean", enum: [false] },
                            error: {
                                type: "object",
                                properties: {
                                    code: { type: "string" },
                                    message: { type: "string" },
                                },
                            },
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };

            // TODO: Wire to Task Store
            return reply.status(404).send({
                success: false,
                error: {
                    code: "TASK_NOT_FOUND",
                    message: `Task ${id} not found. Task Store not yet connected.`,
                },
                timestamp: new Date().toISOString(),
            });
        },
    );

    // PATCH /tasks/:id/cancel — cancel a task
    app.patch(
        "/tasks/:id/cancel",
        {
            schema: {
                tags: ["Tasks"],
                summary: "Cancel a task",
                description: "Cancel an active or pending task",
                params: {
                    type: "object",
                    required: ["id"],
                    properties: {
                        id: { type: "string", format: "uuid" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: taskSchema,
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                    404: {
                        type: "object",
                        properties: {
                            success: { type: "boolean", enum: [false] },
                            error: {
                                type: "object",
                                properties: {
                                    code: { type: "string" },
                                    message: { type: "string" },
                                },
                            },
                            timestamp: { type: "string", format: "date-time" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };

            // TODO: Wire to Task Store
            return reply.status(404).send({
                success: false,
                error: {
                    code: "TASK_NOT_FOUND",
                    message: `Task ${id} not found. Task Store not yet connected.`,
                },
                timestamp: new Date().toISOString(),
            });
        },
    );
}
