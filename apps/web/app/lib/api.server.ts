/**
 * Cliente API server-side.
 * Reenvía la cookie de sesión del navegador al backend Express.
 * SOLO usar desde loaders/actions de Remix (archivos `.server`).
 */
import axios, { type AxiosInstance, type AxiosResponse } from "axios";

const baseURL = process.env.INFRA_API_URL ?? "http://localhost:8301";

export function api(request?: Request): AxiosInstance {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (request) {
    const cookie = request.headers.get("cookie");
    if (cookie) headers.cookie = cookie;
  }
  return axios.create({
    baseURL,
    timeout: 10_000,
    headers,
    // No queremos que axios tire por HTTP errors — los manejamos a mano.
    validateStatus: () => true,
  });
}

/**
 * Forwarder de Set-Cookie: cuando login/logout cambia la cookie en el backend,
 * propagamos al cliente del navegador con el mismo header en la respuesta Remix.
 */
export function forwardSetCookie(response: AxiosResponse): HeadersInit {
  const setCookie = response.headers["set-cookie"];
  if (!setCookie) return {};
  // axios devuelve string[] | string
  if (Array.isArray(setCookie)) {
    // Remix `redirect()` permite múltiples Set-Cookie via Headers
    const headers = new Headers();
    for (const c of setCookie) headers.append("Set-Cookie", c);
    return headers;
  }
  return { "Set-Cookie": setCookie };
}
