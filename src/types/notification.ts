// ─── Notification Types ───────────────────────────────────────

export const NotificationChannel = {
    EMAIL: "email",
    WEBHOOK: "webhook",
    SLACK: "slack",
    TELEGRAM: "telegram",
    IN_APP: "in_app",
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
    PENDING: "pending",
    SENT: "sent",
    FAILED: "failed",
} as const;

export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

/**
 * A notification to be sent to the user.
 */
export interface Notification {
    id: string;
    /** The task that triggered this notification */
    taskId: string;
    /** The user to notify */
    userId: string;
    /** Delivery channel */
    channel: NotificationChannel;
    /** Notification title/subject */
    title: string;
    /** Notification body */
    message: string;
    /** Delivery status */
    status: NotificationStatus;
    /** Channel-specific metadata (e.g., email address, webhook URL) */
    metadata?: Record<string, unknown>;
    sentAt?: Date;
    createdAt: Date;
}

/**
 * User's notification preferences.
 */
export interface NotificationPreferences {
    userId: string;
    /** Default channel for notifications */
    defaultChannel: NotificationChannel;
    /** Channel-specific configs */
    channels: {
        email?: { address: string };
        webhook?: { url: string; headers?: Record<string, string> };
        slack?: { webhookUrl: string; channel?: string };
        telegram?: { chatId: string; botToken: string };
        in_app?: { enabled: boolean };
    };
}
