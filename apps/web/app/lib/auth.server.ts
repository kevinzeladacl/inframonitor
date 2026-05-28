import { redirect } from "@remix-run/node";
import { api } from "./api.server";

export interface SessionUser {
  id: string;
  email: string;
  role: "owner";
}

/**
 * Lee /auth/me usando la cookie de la request. Si no hay sesión, redirige a /login.
 * Uso típico al inicio de un loader de ruta protegida.
 */
export async function requireUser(request: Request): Promise<SessionUser> {
  const res = await api(request).get<SessionUser>("/api/v1/auth/me");
  if (res.status === 200 && res.data?.id) return res.data;
  throw redirect("/login");
}

/** Igual que requireUser pero devuelve null si no hay sesión (no redirect). */
export async function getOptionalUser(request: Request): Promise<SessionUser | null> {
  const res = await api(request).get<SessionUser>("/api/v1/auth/me");
  if (res.status === 200 && res.data?.id) return res.data;
  return null;
}
