// ⚠️ Mantener este import como el PRIMERO de la app — carga .env.
import "./env-loader.js";

import { env } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./config/db.js";
import { buildApp } from "./http.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const t0 = Date.now();
  logger.info("🚀 Iniciando Inframonitor API…");

  await connectMongo();

  const { httpServer } = buildApp();

  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, web: env.WEB_ORIGIN, bootMs: Date.now() - t0 },
      `🌐 API escuchando en http://localhost:${env.PORT}`
    );
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "🛑 Apagando…");
    try {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      await disconnectMongo();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error en shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason, promise) => {
    logger.error({ reason, promise }, "Unhandled Rejection");
  });
}

main().catch((err) => {
  logger.error({ err }, "❌ Error fatal en startup");
  process.exit(1);
});
