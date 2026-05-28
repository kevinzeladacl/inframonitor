import type { Request, Response, NextFunction } from "express";
import { COOKIE_NAME, verifyToken, type JwtPayload } from "../utils/jwt.js";

/**
 * Auth real Fase 2:
 * - Lee JWT desde cookie HttpOnly (preferido) o `Authorization: Bearer <token>`.
 * - Si no hay token o es inválido, 401.
 * - Las rutas /auth/* y /health quedan exentas (se montan antes del middleware).
 */

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function extractToken(req: Request): string | null {
  const fromCookie = (req as { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return null;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sesión requerida" } });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Token inválido o expirado" } });
    return;
  }
  req.user = payload;
  next();
}
