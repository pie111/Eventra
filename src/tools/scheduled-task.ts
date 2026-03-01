// ─── Create Scheduled Task Tool ──────────────────────────────
// Allows the agent to schedule persistent monitoring tasks (Deep Agent pattern).

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getDb } from "../db/connection.js";
import { TaskStore } from "../db/task-store.js";
import { Queue } from "bullmq";
import Redis from "ioredis";

// Lazy-initialize the queue so we don't connect to Redis if this tool is never used
let taskQueue: Queue | null = null;
function getQueue() {
    if (!taskQueue) {
        const isUpstash = (process.env.REDIS_HOST || "").includes("upstash");
        const connection = new Redis({
            host: isUpstash ? "localhost" : process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379", 10),
            maxRetriesPerRequest: null,
        }) as any;
        taskQueue = new Queue("eventra-tasks", { connection });
    }
    return taskQueue;
}

export const create_scheduled_task = new DynamicStructuredTool({
    name: "create_scheduled_task",
    description:
        "Schedule a persistent monitoring task. Use this when the user asks to be notified or alerted about future conditions (e.g., 'tell me when AAPL drops below 150').",
    schema: z.object({
        description: z.string().describe("Human-readable description of what is being monitored"),
        toolName: z.string().describe("The name of the tool to use for checking the data (e.g., 'get_stock_price', 'get_weather')"),
        toolParams: z.record(z.unknown()).optional().describe("Parameters to pass to the tool to get the data (e.g., {\"symbol\": \"AAPL\"}). Can be omitted if the tool requires no params."),
        condition: z.object({
            operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]).describe("Comparison operator"),
            field: z.string().describe("The field in the tool's result to compare (e.g., 'price' for stock, 'temperature' for weather)"),
            value: z.unknown().describe("The target value to compare against"),
        }).describe("The condition that must be met to trigger the alert"),
        intervalMs: z.number().optional().describe("How often to check, in milliseconds. Defaults to 60000ms (1 minute)."),
    }),
    func: async (params) => {
        try {
            const db = getDb();
            const taskStore = new TaskStore(db);
            const intervalMs = params.intervalMs ?? 60000;
            const toolParams = params.toolParams ?? {};

            const task = await taskStore.createTask({
                description: params.description,
                executionType: "persistent",
                toolName: params.toolName,
                toolParams,
                condition: {
                    description: params.description,
                    toolName: params.toolName,
                    toolParams,
                    operator: params.condition.operator,
                    field: params.condition.field,
                    value: params.condition.value,
                },
                schedule: {
                    intervalMs,
                },
            });

            // Schedule with BullMQ
            const queue = getQueue();
            await queue.add(
                `evaluate-${task.id}`,
                { taskId: task.id },
                {
                    jobId: `repeat-${task.id}`,
                    repeat: { every: intervalMs },
                }
            );

            return JSON.stringify({
                status: "success",
                message: `Successfully scheduled task to monitor: ${params.description}`,
                taskId: task.id,
            });
        } catch (error) {
            return JSON.stringify({
                status: "error",
                message: error instanceof Error ? error.message : "Failed to create scheduled task",
            });
        }
    },
});
