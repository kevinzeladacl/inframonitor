import type { Socket } from "socket.io";
import cookie from "cookie";
import { COOKIE_NAME, verifyToken, type JwtPayload } from "../utils/jwt.js";

/**
 * Middleware Socket.IO que verifica la cookie JWT en el handshake.
 * Aplicar con `nsp.use(socketAuth)` en cada namespace protegido.
 *
 * Después del middleware, el JwtPayload queda en `socket.data.user`.
 */
export function socketAuth(socket: Socket, next: (err?: Error) => void) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return next(new Error("UNAUTHENTICATED"));
    const cookies = cookie.parse(cookieHeader);
    const token = cookies[COOKIE_NAME];
    if (!token) return next(new Error("UNAUTHENTICATED"));
    const payload = verifyToken(token);
    if (!payload) return next(new Error("INVALID_TOKEN"));
    (socket.data as { user: JwtPayload }).user = payload;
    next();
  } catch (err) {
    next(err as Error);
  }
}
