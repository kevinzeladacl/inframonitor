import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { Server as HttpServer } from "node:http";
import { Server as IOServer } from "socket.io";

import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { apiRouter, publicApiRouter } from "./routes/index.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { ioRef } from "./sockets/registry.js";
import { attachTerminalNamespace } from "./sockets/terminal.js";
import { attachLogsNamespace } from "./sockets/logs.js";
import { attachProvisionNamespace } from "./sockets/provision.js";

export interface AppHandles {
  app: Express;
  httpServer: HttpServer;
  io: IOServer;
}

export function buildApp(): AppHandles {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  // Health expuesta sin auth y sin prefijo /api/v1 (readiness checks)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  // Endpoints públicos (auth, health interno)
  app.use("/api/v1", publicApiRouter);

  // Endpoints protegidos: TODO lo demás requiere JWT
  app.use("/api/v1", requireAuth, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  const httpServer = new HttpServer(app);

  const io = new IOServer(httpServer, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
    path: "/socket.io",
  });

  // Namespaces protegidos por cookie JWT.
  attachTerminalNamespace(io.of("/terminal"));
  attachLogsNamespace(io.of("/logs"));
  attachProvisionNamespace(io.of("/provision"));

  // Registrar el io global para que las rutas puedan emit() desde HTTP handlers
  // (ej. dispararás un playbook/provision por POST y necesitas mandar eventos).
  ioRef.set(io);

  return { app, httpServer, io };
}
