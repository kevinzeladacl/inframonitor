import type { Namespace } from "socket.io";
import { socketAuth } from "./auth.js";
import { logger } from "../utils/logger.js";

/**
 * Namespace /provision — el cliente se une a `room=socketRoom` que devolvió
 * /provision/start o /playbooks/.../run-on/...
 *
 * Eventos cliente→servidor:
 *   - join(socketRoom)
 *   - leave(socketRoom)
 *
 * Eventos servidor→cliente (emitidos por los services):
 *   - phase({ phase })
 *   - log({ line, level, ts })
 *   - step:start / step:output / step:end
 *   - run:done / run:error
 *   - done({ serverId })
 *   - error({ message })
 */
export function attachProvisionNamespace(nsp: Namespace) {
  nsp.use(socketAuth);

  nsp.on("connection", (socket) => {
    socket.on("join", (room: string) => {
      socket.join(room);
      socket.emit("joined", { room });
    });
    socket.on("leave", (room: string) => {
      socket.leave(room);
    });
    socket.on("disconnect", () => {
      logger.debug({ id: socket.id }, "🔌 /provision disconnect");
    });
  });
}
