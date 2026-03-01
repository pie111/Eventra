// ─── Built-in Tools ───────────────────────────────────────────

import { DynamicStructuredTool } from "@langchain/core/tools";
import { stockPriceTool } from "./stock-price";
import { weatherTool } from "./weather";
import { dateTimeTool } from "./datetime";
import { calculatorTool } from "./calculator";
import { create_scheduled_task } from "./scheduled-task";

export { stockPriceTool, weatherTool, dateTimeTool, calculatorTool, create_scheduled_task };

/**
 * Array of all built-in tools ready to be registered.
 */
export const builtinTools: DynamicStructuredTool[] = [
    stockPriceTool,
    weatherTool,
    dateTimeTool,
    calculatorTool,
    create_scheduled_task,
];
