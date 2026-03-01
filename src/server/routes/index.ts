// ─── Route Registration ───────────────────────────────────────

import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./health";
import { agentRoutes } from "./agent";
import { taskRoutes } from "./tasks";
import { toolRoutes } from "./tools";
import { llmConfigRoutes } from "./llm-config";

/**
 * Register all route modules on the Fastify instance.
 */
export async function registerRoutes(app: FastifyInstance) {
    await app.register(healthRoutes);
    await app.register(agentRoutes);
    await app.register(taskRoutes);
    await app.register(toolRoutes);
    await app.register(llmConfigRoutes);
}
