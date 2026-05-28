import type { Namespace } from "socket.io";
import { socketAuth } from "./auth.js";
import { getServerSshConfig, openShell } from "../services/ssh.service.js";
import { logger } from "../utils/logger.js";
import type { Client as SshClient, ClientChannel } from "ssh2";

/**
 * Namespace /terminal — un cliente abre una shell SSH sobre un Server.
 *
 * Eventos cliente→servidor:
 *   - open({ serverId, cols, rows })  abre la conexión
 *   - data(string)                    envía teclas
 *   - resize({ cols, rows })          notifica resize del terminal
 *
 * Eventos servidor→cliente:
 *   - ready              shell lista, ya puede tipear
 *   - data(string)       stdout/stderr del shell
 *   - error(message)     algo falló (no auth, host inalcanzable, etc.)
 *   - exit(code)         el shell terminó
 */
export function attachTerminalNamespace(nsp: Namespace) {
  nsp.use(socketAuth);

  nsp.on("connection", (socket) => {
    let sshClient: SshClient | null = null;
    let channel: ClientChannel | null = null;

    const cleanup = () => {
      if (channel) {
        try { channel.end(); } catch { /* noop */ }
        channel = null;
      }
      if (sshClient) {
        try { sshClient.end(); } catch { /* noop */ }
        sshClient = null;
      }
    };

    socket.on("open", async (payload: { serverId: string; cols?: number; rows?: number }) => {
      try {
        const cfg = await getServerSshConfig(payload.serverId);
        const opened = await openShell(cfg, { cols: payload.cols, rows: payload.rows });
        sshClient = opened.client;
        channel = opened.channel;

        channel.on("data", (d: Buffer) => socket.emit("data", d.toString("utf8")));
        channel.stderr.on("data", (d: Buffer) => socket.emit("data", d.toString("utf8")));
        channel.on("close", (code: number) => {
          socket.emit("exit", code);
          cleanup();
        });

        socket.emit("ready");
      } catch (err: any) {
        socket.emit("error", err?.message ?? String(err));
        cleanup();
      }
    });

    socket.on("data", (data: string) => {
      if (channel) channel.write(data);
    });

    socket.on("resize", ({ cols, rows }: { cols: number; rows: number }) => {
      if (channel) channel.setWindow(rows, cols, 0, 0);
    });

    socket.on("disconnect", () => {
      logger.debug({ id: socket.id }, "🔌 /terminal disconnect");
      cleanup();
    });
  });
}
