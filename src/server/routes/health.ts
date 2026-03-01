// ─── Health Check Routes ──────────────────────────────────────

import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
    app.get(
        "/health",
        {
            schema: {
                tags: ["Health"],
                summary: "Health check",
                description: "Returns the current health status of the API Gateway",
                response: {
                    200: {
                        type: "object",
                        properties: {
                            status: { type: "string", enum: ["ok"] },
                            timestamp: { type: "string", format: "date-time" },
                            uptime: { type: "number", description: "Uptime in seconds" },
                            version: { type: "string" },
                        },
                    },
                },
            },
        },
        async () => {
            return {
                status: "ok",
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: "0.1.0",
            };
        },
    );
}
