/**
 * DTOs de respuesta HTTP comunes entre API y Web.
 * Para payloads de entrada, cada feature define su propio zod schema en apps/api.
 */

export interface AuthMeResponse {
  id: string;
  email: string;
  role: "owner";
}

export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  uptimeSec: number;
  mongo: "ok" | "down";
  version: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
