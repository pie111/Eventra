// ─── Server Configuration ─────────────────────────────────────

export interface ServerConfig {
    host: string;
    port: number;
    logger: boolean;
}

export const config: ServerConfig = {
    host: process.env.HOST ?? "0.0.0.0",
    port: parseInt(process.env.PORT ?? "3008", 10),
    logger: process.env.NODE_ENV !== "test",
};
