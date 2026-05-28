import type { Namespace } from "socket.io";
import { socketAuth } from "./auth.js";
import { subscribe, unsubscribe, onSocketDisconnect } from "../services/log-stream.service.js";
import { logger } from "../utils/logger.js";

/**
 * Namespace /logs.
 *
 * Eventos cliente→servidor:
 *   - subscribe({ serverId, containerId? })
 *   - unsubscribe({ serverId, containerId? })
 *
 * Eventos servidor→cliente:
 *   - subscribed({ room })
 *   - log:line({ serverId, containerId?, source, level, message, ts })
 *   - error(message)
 */
export function attachLogsNamespace(nsp: Namespace) {
  nsp.use(socketAuth);

  nsp.on("connection", (socket) => {
    socket.on("subscribe", async (payload: { serverId: string; containerId?: string }) => {
      try {
        await subscribe(socket, nsp, payload);
      } catch (err: any) {
        socket.emit("error", err?.message ?? String(err));
      }
    });

    socket.on("unsubscribe", (payload: { serverId: string; containerId?: string }) => {
      unsubscribe(socket, payload);
    });

    socket.on("disconnect", () => {
      logger.debug({ id: socket.id }, "🔌 /logs disconnect");
      onSocketDisconnect(socket);
    });
  });
}
