// ─── Calculator Tool ──────────────────────────────────────────

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

export const calculatorTool = new DynamicStructuredTool({
    name: "calculator",
    description: "Evaluate a mathematical expression. Supports basic arithmetic, percentages, and exponents.",
    schema: z.object({
        expression: z.string().describe("Math expression to evaluate (e.g., '(100 * 1.15) + 50', '25% of 200')"),
    }),
    func: async ({ expression }) => {
        try {
            // Pre-process: handle "X% of Y" patterns
            let processed = expression.replace(
                /(\d+(?:\.\d+)?)%\s*of\s*(\d+(?:\.\d+)?)/gi,
                (_, pct, num) => `(${pct} / 100 * ${num})`,
            );

            // Sanitize: only allow numbers, operators, parentheses, dots, spaces
            if (!/^[\d\s+\-*/().%^]+$/.test(processed)) {
                return JSON.stringify({ error: "Expression contains invalid characters." });
            }

            // Replace ^ with ** for exponentiation
            processed = processed.replace(/\^/g, "**");

            const result = new Function(`"use strict"; return (${processed})`)() as number;

            if (typeof result !== "number" || !isFinite(result)) {
                return JSON.stringify({ error: "Expression resulted in an invalid number." });
            }

            return JSON.stringify({
                expression,
                result: parseFloat(result.toPrecision(12)),
            });
        } catch (err) {
            return JSON.stringify({ error: `Failed to evaluate: ${err instanceof Error ? err.message : String(err)}` });
        }
    },
});
