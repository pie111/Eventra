// ─── Fastify Server Factory ───────────────────────────────────

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { config } from "./config";
import { registerRoutes } from "./routes/index";

/**
 * Creates and configures the Fastify server instance.
 */
export async function buildServer(): Promise<FastifyInstance> {
    const app = Fastify({
        logger: config.logger
            ? {
                transport: {
                    target: "pino-pretty",
                    options: { colorize: true },
                },
            }
            : false,
    });

    // ── CORS ──────────────────────────────────────────────────
    await app.register(cors, {
        origin: true, // Allow all origins in dev
    });

    // ── Swagger API Docs ──────────────────────────────────────
    await app.register(swagger, {
        openapi: {
            openapi: "3.1.0",
            info: {
                title: "Eventra API",
                description:
                    "Stateful, event-driven LLM agent system — API Gateway",
                version: "0.1.0",
            },
            servers: [
                {
                    url: `http://localhost:${config.port}`,
                    description: "Local development",
                },
            ],
            tags: [
                {
                    name: "Agent",
                    description: "Core agent interaction endpoints",
                },
                {
                    name: "Tasks",
                    description: "Task management (CRUD for persistent tasks)",
                },
                { name: "Tools", description: "Tool registry inspection" },
                { name: "Health", description: "Health check endpoints" },
                {
                    name: "LLM",
                    description: "LLM provider configuration and testing",
                },
            ],
        },
    });

    await app.register(swaggerUI, {
        routePrefix: "/docs",
        uiConfig: {
            docExpansion: "list",
            deepLinking: true,
        },
    });

    // ── Routes ────────────────────────────────────────────────
    await registerRoutes(app);

    return app;
}
