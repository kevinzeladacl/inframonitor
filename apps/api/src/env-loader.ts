/**
 * Carga .env desde la raíz del monorepo ANTES de cualquier otro import.
 * Mantener este import como primero en main.ts y en scripts.
 */
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// apps/api/src/env-loader.ts → 3 niveles arriba = raíz del monorepo
const rootEnvPath = path.resolve(__dirname, "../../../.env");

const result = loadDotenv({ path: rootEnvPath });

if (result.error) {
  console.warn(
    `⚠️  No se pudo cargar .env (${rootEnvPath}): ${result.error.message}`
  );
  console.warn("   Continuando con variables de entorno del sistema.");
}
