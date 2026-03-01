// ─── Condition Evaluator ──────────────────────────────────────
// Evaluates a task's condition against the result of a tool call.

export function evaluateCondition(result: unknown, condition: any): boolean {
    if (!condition) return false;

    // Retrieve the field from the result. Supports nested fields (e.g. "data.price")
    const fieldValue = getNestedField(result, condition.field);

    if (fieldValue === undefined) {
        console.warn(`Condition field '${condition.field}' not found in tool result:`, result);
        return false; // Cannot evaluate
    }

    const { operator, value: targetValue } = condition;

    switch (operator) {
        case "eq":
            return fieldValue === targetValue;
        case "neq":
            return fieldValue !== targetValue;
        case "gt":
            return Number(fieldValue) > Number(targetValue);
        case "gte":
            return Number(fieldValue) >= Number(targetValue);
        case "lt":
            return Number(fieldValue) < Number(targetValue);
        case "lte":
            return Number(fieldValue) <= Number(targetValue);
        case "contains":
            return String(fieldValue).toLowerCase().includes(String(targetValue).toLowerCase());
        default:
            console.warn(`Unknown condition operator: ${operator}`);
            return false;
    }
}

/**
 * Safely extracts a nested field from an object using a dot-notation path.
 */
function getNestedField(obj: any, path: string): unknown {
    if (!path || typeof obj !== "object") return undefined;

    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = current[key];
    }

    return current;
}
