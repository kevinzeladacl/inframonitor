/**
 * Helpers para implementar actions CRUD desde Remix routes.
 * Cada action interpreta `intent` (`create | update | delete`) y dispatcha al backend.
 */
import { api } from "./api.server";

export interface CrudActionResult {
  ok: boolean;
  error?: string;
  details?: unknown;
}

export async function handleCrudAction(
  request: Request,
  basePath: string,
  form: FormData
): Promise<CrudActionResult> {
  const intent = String(form.get("intent") ?? "");
  const id = String(form.get("id") ?? "");
  const payload = formToPayload(form);

  const client = api(request);

  if (intent === "create") {
    const res = await client.post(basePath, payload);
    if (res.status >= 400) {
      return { ok: false, error: res.data?.error?.message ?? "Error al crear", details: res.data };
    }
    return { ok: true };
  }

  if (intent === "update") {
    if (!id) return { ok: false, error: "id requerido" };
    const res = await client.patch(`${basePath}/${id}`, payload);
    if (res.status >= 400) {
      return { ok: false, error: res.data?.error?.message ?? "Error al actualizar", details: res.data };
    }
    return { ok: true };
  }

  if (intent === "delete") {
    if (!id) return { ok: false, error: "id requerido" };
    const res = await client.delete(`${basePath}/${id}`);
    if (res.status >= 400) {
      return { ok: false, error: res.data?.error?.message ?? "Error al eliminar" };
    }
    return { ok: true };
  }

  return { ok: false, error: `Intent inválido: ${intent}` };
}

/**
 * Convierte FormData en un payload JSON.
 * Reglas:
 * - claves `__` se ignoran (intent, id, etc.)
 * - valores "" → undefined (no se incluyen)
 * - valores que parsean a número entero → number (campos `port`, `cpu`, etc.)
 * - claves con `[]` se acumulan en arrays
 */
function formToPayload(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of form.entries()) {
    if (rawKey === "intent" || rawKey === "id") continue;
    const value = typeof rawValue === "string" ? rawValue : "";
    if (value === "") continue;

    let key = rawKey;
    const isArray = key.endsWith("[]");
    if (isArray) key = key.slice(0, -2);

    const parsed = coerce(key, value);

    if (isArray) {
      const existing = out[key];
      if (Array.isArray(existing)) {
        existing.push(parsed);
      } else {
        out[key] = [parsed];
      }
    } else {
      out[key] = parsed;
    }
  }
  return out;
}

const NUMERIC_KEYS = new Set([
  "port",
  "cpu",
  "ramMb",
  "diskGb",
  "hourlyUsd",
  "monthlyUsd",
  "uptimeSeconds",
]);

function coerce(key: string, value: string): unknown {
  if (NUMERIC_KEYS.has(key)) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return value;
}
