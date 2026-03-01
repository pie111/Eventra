// ─── Eventra Background Worker (BullMQ) ────────────────────────
// Uses BullMQ to reliably process persistent tasks.

import "dotenv/config";
import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { getDb } from "../db/connection.js";
import { TaskStore } from "../db/task-store.js";
import { ToolRegistry } from "../tools/registry.js";
import { builtinTools } from "../tools/index.js";
import { evaluateCondition } from "./evaluator.js";
import { closeDb } from "../db/connection.js";

// ─── Redis Connection ─────────────────────────────────────────

// Ignore Upstash host if it crept in from another local config or .zshrc
const isUpstash = (process.env.REDIS_HOST || "").includes("upstash");

const redisOptions = {
    host: isUpstash ? "localhost" : process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null,
};

// BullMQ's expected connection type in TS requires explicit connection object shape
const connection = new Redis(redisOptions) as any;

// ─── BullMQ Setup ─────────────────────────────────────────────

const QUEUE_NAME = "eventra-tasks";

export const taskQueue = new Queue(QUEUE_NAME, { connection });

// ─── Worker Initialization ────────────────────────────────────

async function main() {
    console.log("🚀 Starting Eventra BullMQ Worker...");

    const db = getDb();
    const taskStore = new TaskStore(db);
    const toolRegistry = new ToolRegistry();

    // Register built-in tools
    builtinTools.forEach((tool) => toolRegistry.register(tool));

    console.log(`✅ Loaded ${toolRegistry.getAll().length} tools into registry`);
    console.log(`✅ Connected to Redis at ${redisOptions.host}:${redisOptions.port}`);

    // Schedule active tasks if they aren't already in the queue
    // (A real system might use repeatable jobs for interval-based checks)
    await bootstrapQueue(taskStore);

    const worker = new Worker(
        QUEUE_NAME,
        async (job: Job) => {
            await processJob(job, taskStore, toolRegistry);
        },
        { connection }
    );

    worker.on("completed", (job) => {
        console.log(`✅ Job ${job.id} completed successfully`);
    });

    worker.on("failed", (job, err) => {
        console.error(`💥 Job ${job?.id} failed:`, err.message);
    });

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
        console.log("\nShutting down worker...");
        await worker.close();
        await taskQueue.close();
        await connection.quit();
        await closeDb();
        process.exit(0);
    });
}

/**
 * Finds all 'active' tasks and adds to the queue if not already managed
 */
async function bootstrapQueue(taskStore: TaskStore) {
    const activeTasks = await taskStore.listActiveTasks();
    console.log(`📦 Bootstrapping ${activeTasks.length} active persistent tasks...`);

    for (const task of activeTasks) {
        const intervalMs = task.schedule?.intervalMs ?? 60000;

        // Add as a repeatable job in BullMQ
        await taskQueue.add(
            `evaluate-${task.id}`,
            { taskId: task.id },
            {
                jobId: `repeat-${task.id}`, // specific ID to prevent duplicates
                repeat: {
                    every: intervalMs
                }
            }
        );
    }
}

/**
 * The actual job processor logic
 */
async function processJob(job: Job, taskStore: TaskStore, toolRegistry: ToolRegistry) {
    const { taskId } = job.data;
    const task = await taskStore.getTask(taskId);

    if (!task) {
        throw new Error(`Task ${taskId} not found in database`);
    }

    if (task.status !== "active") {
        // If task is no longer active (e.g. cancelled/completed), remove its repeatable job
        await taskQueue.removeRepeatableByKey(job.repeatJobKey!);
        return;
    }

    const tool = toolRegistry.get(task.toolName);
    if (!tool) {
        throw new Error(`Unknown tool: ${task.toolName}`);
    }

    console.log(`⏳ Executing '${task.toolName}' for task: ${task.description}`);
    const startTime = Date.now();

    try {
        let resultData;
        const args = Object.keys(task.toolParams).length > 0 ? task.toolParams : undefined;
        const rawResult = await tool.invoke(args);

        try {
            resultData = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
        } catch {
            resultData = { response: rawResult };
        }

        const conditionMet = evaluateCondition(resultData, task.condition);
        const executionTimeMs = Date.now() - startTime;

        await taskStore.createTaskRun({
            taskId: task.id,
            conditionMet,
            result: resultData,
            executionTimeMs,
        });

        await taskStore.recordEvaluation(task.id, resultData);

        if (conditionMet) {
            console.log(`🚨 CONDITION MET for task ${task.id}: ${task.description}`);

            // TODO: Push to Event Bus / notification queue

            // End the monitoring
            await taskStore.updateTaskStatus(task.id, "completed");
            if (job.repeatJobKey) {
                await taskQueue.removeRepeatableByKey(job.repeatJobKey);
            }
        }

    } catch (error) {
        await taskStore.createTaskRun({
            taskId: task.id,
            conditionMet: false,
            error: (error as Error).message,
            executionTimeMs: Date.now() - startTime,
        });
        throw error; // Let BullMQ handle retries if configured
    }
}

main().catch(console.error);
