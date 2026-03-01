// ─── Eventra Entrypoint ───────────────────────────────────────
// Single entry point that starts the API Gateway server.

import "dotenv/config";
import { buildServer } from "./server/server";
import { config } from "./server/config";

async function main() {
    const server = await buildServer();

    try {
        await server.listen({ host: config.host, port: config.port });
        console.log(`\n🚀 Eventra API Gateway running at http://${config.host}:${config.port}`);
        console.log(`📖 Swagger docs at http://${config.host}:${config.port}/docs\n`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}

main();
