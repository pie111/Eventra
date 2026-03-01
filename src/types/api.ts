// ─── API Types ────────────────────────────────────────────────

/**
 * Standard API response wrapper.
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    /** ISO timestamp */
    timestamp: string;
}

/**
 * Standard API error shape.
 */
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

/**
 * Paginated list response.
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

/**
 * The primary request payload — a user's natural language message.
 */
export interface AgentRequest {
    /** The user's natural language message */
    message: string;
    /** Optional conversation ID for multi-turn context */
    conversationId?: string;
    /** User ID (typically set by auth middleware) */
    userId?: string;
}

/**
 * The primary response — either an immediate result or task acknowledgement.
 */
export interface AgentResponse {
    /** Human-readable response text */
    message: string;
    /** The execution type that was chosen */
    executionType: "immediate" | "persistent";
    /** Result data (for immediate execution) */
    result?: unknown;
    /** Created task ID (for persistent tasks) */
    taskId?: string;
}
