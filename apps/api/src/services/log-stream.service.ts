import type { Namespace, Socket } from "socket.io";
import type { Client as SshClient, ClientChannel } from "ssh2";
import { LogEntryModel } from "@inframonitor/database";
import { getServerSshConfig, openSshClient } from "./ssh.service.js";
import { logger } from "../utils/logger.js";

/**
 * Manager de streaming de logs por servidor/container.
 *
 * - Una sola conexión SSH + `tail -F` por (serverId, containerId|"server")
 *   compartida entre todos los suscriptores vía Socket.IO rooms.
 * - Cuando el último suscriptor se va, se cierra el tail y la conexión SSH.
 * - Las líneas se acumulan en un buffer en memoria y se flushean a Mongo
 *   en batches de 50 o cada 2s (lo primero).
 */

interface ActiveStream {
  client: SshClient;
  channel: ClientChannel;
  room: string;
  subscribers: Set<string>; // socket.id
  flushTimer?: NodeJS.Timeout;
  buffer: Array<{
    serverId: string;
    containerId?: string;
    message: string;
    level: "debug" | "info" | "warn" | "error";
    source: "syslog" | "docker";
    ts: Date;
  }>;
}

const streams = new Map<string, ActiveStream>();

function streamKey(serverId: string, containerId?: string): string {
  return containerId ? `container:${containerId}` : `server:${serverId}`;
}

function buildCommand(containerId?: string): string {
  if (containerId) {
    return `docker logs -f --tail=50 ${containerId} 2>&1`;
  }
  // Cosas comunes Ubuntu/Debian. Si no hay journalctl, cae a syslog.
  return "journalctl -f -n 50 2>/dev/null || tail -F -n 50 /var/log/syslog";
}

async function startStreamIfNeeded(
  serverId: string,
  containerId: string | undefined,
  nsp: Namespace
): Promise<ActiveStream> {
  const key = streamKey(serverId, containerId);
  const existing = streams.get(key);
  if (existing) return existing;

  const cfg = await getServerSshConfig(serverId);
  const sshClient = await openSshClient(cfg, { timeoutMs: 15_000 });

  return new Promise((resolve, reject) => {
    sshClient.exec(buildCommand(containerId), { pty: true }, (err, channel) => {
      if (err) {
        sshClient.end();
        reject(err);
        return;
      }

      const stream: ActiveStream = {
        client: sshClient,
        channel,
        room: key,
        subscribers: new Set(),
        buffer: [],
      };

      const flushBuffer = () => {
        if (stream.buffer.length === 0) return;
        const docs = stream.buffer.splice(0, stream.buffer.length);
        LogEntryModel.insertMany(docs, { ordered: false }).catch((err) =>
          logger.warn({ err: (err as Error).message }, "log buffer flush failed")
        );
      };

      stream.flushTimer = setInterval(flushBuffer, 2_000);

      const onLine = (raw: string) => {
        for (const line of raw.split("\n")) {
          const t = line.replace(/\r/g, "").trimEnd();
          if (!t) continue;
          const level: ActiveStream["buffer"][number]["level"] = /error/i.test(t)
            ? "error"
            : /warn/i.test(t)
            ? "warn"
            : "info";
          const entry = {
            serverId,
            containerId,
            message: t,
            level,
            source: (containerId ? "docker" : "syslog") as "docker" | "syslog",
            ts: new Date(),
          };
          stream.buffer.push(entry);
          if (stream.buffer.length >= 50) flushBuffer();
          nsp.to(key).emit("log:line", {
            serverId,
            containerId,
            source: entry.source,
            level: entry.level,
            message: entry.message,
            ts: entry.ts.toISOString(),
          });
        }
      };

      channel.on("data", (d: Buffer) => onLine(d.toString("utf8")));
      channel.stderr.on("data", (d: Buffer) => onLine(d.toString("utf8")));
      channel.on("close", () => stopStream(key));

      streams.set(key, stream);
      resolve(stream);
    });
  });
}

function stopStream(key: string) {
  const stream = streams.get(key);
  if (!stream) return;
  if (stream.flushTimer) clearInterval(stream.flushTimer);
  // flush final
  if (stream.buffer.length > 0) {
    LogEntryModel.insertMany(stream.buffer, { ordered: false }).catch(() => undefined);
  }
  try { stream.channel.end(); } catch { /* noop */ }
  try { stream.client.end(); } catch { /* noop */ }
  streams.delete(key);
  logger.debug({ key }, "🪵 log stream cerrado");
}

export async function subscribe(
  socket: Socket,
  nsp: Namespace,
  payload: { serverId: string; containerId?: string }
): Promise<void> {
  const key = streamKey(payload.serverId, payload.containerId);
  let stream = streams.get(key);
  if (!stream) {
    stream = await startStreamIfNeeded(payload.serverId, payload.containerId, nsp);
  }
  socket.join(key);
  stream.subscribers.add(socket.id);
  socket.emit("subscribed", { room: key });
}

export function unsubscribe(socket: Socket, payload: { serverId: string; containerId?: string }) {
  const key = streamKey(payload.serverId, payload.containerId);
  const stream = streams.get(key);
  if (!stream) return;
  socket.leave(key);
  stream.subscribers.delete(socket.id);
  if (stream.subscribers.size === 0) {
    stopStream(key);
  }
}

export function onSocketDisconnect(socket: Socket) {
  // Limpia subscripciones del socket en todos los streams.
  for (const [key, stream] of streams.entries()) {
    if (stream.subscribers.delete(socket.id)) {
      if (stream.subscribers.size === 0) stopStream(key);
    }
  }
}
