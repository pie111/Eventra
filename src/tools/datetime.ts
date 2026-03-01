// ─── Date/Time Tool ──────────────────────────────────────────

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const dateTimeTool = new DynamicStructuredTool({
    name: "get_datetime",
    description: "Get the current date and time, optionally for a specific timezone.",
    schema: z.object({
        timezone: z
            .string()
            .default("UTC")
            .describe("IANA timezone (e.g., 'America/New_York', 'Asia/Tokyo'). Defaults to UTC."),
    }),
    func: async ({ timezone }) => {
        try {
            const now = new Date();
            const formatted = now.toLocaleString("en-US", {
                timeZone: timezone,
                dateStyle: "full",
                timeStyle: "long",
            });

            return JSON.stringify({
                timezone,
                datetime: formatted,
                iso: now.toISOString(),
                unix: Math.floor(now.getTime() / 1000),
            });
        } catch {
            return JSON.stringify({
                error: `Invalid timezone "${timezone}". Use IANA format (e.g., "America/New_York").`,
            });
        }
    },
});
