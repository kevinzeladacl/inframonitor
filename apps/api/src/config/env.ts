/**
 * Tipa y valida las variables de entorno usadas por la API.
 * Lanza error temprano si falta algo crítico.
 */

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(`Variable de entorno faltante: ${name}`);
  }
  return v;
}

function asInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",

  PORT: asInt(process.env.INFRA_API_PORT, 8301),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? `http://localhost:${asInt(process.env.INFRA_WEB_PORT, 5274)}`,

  MONGO: {
    PORT: asInt(process.env.MONGO_PORT, 27117),
    USER: process.env.MONGO_ROOT_USERNAME ?? "admin",
    PASS: process.env.MONGO_ROOT_PASSWORD ?? "admin123",
    DB: process.env.MONGO_DATABASE ?? "inframonitor_dev",
    URI_OVERRIDE: process.env.MONGO_URI ?? null,
  },

  JWT_SECRET: required("JWT_SECRET", "dev-only-secret-cambiar-en-prod-32bytes-min"),

  OWNER_EMAIL: process.env.OWNER_EMAIL ?? "owner@inframonitor.local",
  OWNER_PASSWORD: process.env.OWNER_PASSWORD ?? "changeme",

  // Solo presente desde Fase 3 — en Fase 1 puede estar vacío.
  MASTER_KEY: process.env.MASTER_KEY ?? null,
} as const;

export function buildMongoUri(): string {
  if (env.MONGO.URI_OVERRIDE) return env.MONGO.URI_OVERRIDE;
  const { USER, PASS, PORT, DB } = env.MONGO;
  const auth = USER && PASS ? `${encodeURIComponent(USER)}:${encodeURIComponent(PASS)}@` : "";
  return `mongodb://${auth}localhost:${PORT}/${DB}?authSource=admin`;
}
