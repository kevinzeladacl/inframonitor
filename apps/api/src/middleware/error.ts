import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Ruta no encontrada: ${req.method} ${req.path}` },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Payload inválido",
        details: err.flatten(),
      },
    });
    return;
  }

  const status = (err as { status?: number }).status ?? 500;
  logger.error({ err }, "Error no controlado");
  res.status(status).json({
    error: {
      code: (err as { code?: string }).code ?? "INTERNAL_ERROR",
      message: (err as Error).message ?? "Error interno",
    },
  });
};
