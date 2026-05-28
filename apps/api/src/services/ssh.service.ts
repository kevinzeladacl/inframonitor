import { Client as SshClient, type ClientChannel, type ConnectConfig } from "ssh2";
import { ServerModel } from "@inframonitor/database";
import { getDecryptedPrivateKey } from "./ssh-key.service.js";
import { logger } from "../utils/logger.js";

/**
 * Servicio de conexiones SSH (ssh2).
 * - Cada llamada abre y cierra su propia conexión (no pooling agresivo para MVP).
 * - Para el terminal socket, mantenemos una conexión por sesión.
 */

export interface SshConnectConfig {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}

export async function getServerSshConfig(serverId: string): Promise<SshConnectConfig> {
  const server = await ServerModel.findOne({ id: serverId, deletedAt: null });
  if (!server) throw new Error(`Server ${serverId} no existe`);
  if (!server.publicIp) throw new Error("Server sin IP pública (no se puede SSH)");
  if (!server.ssh?.keyId) throw new Error("Server sin SshKey asignada");
  const privateKey = await getDecryptedPrivateKey(server.ssh.keyId);
  return {
    host: server.publicIp,
    port: server.ssh.port ?? 22,
    username: server.ssh.user ?? "root",
    privateKey,
  };
}

/** Abre una conexión SSH y devuelve el client listo. Hace que el caller la cierre. */
export function openSshClient(cfg: SshConnectConfig, opts: { timeoutMs?: number } = {}): Promise<SshClient> {
  return new Promise((resolve, reject) => {
    const client = new SshClient();
    const connectCfg: ConnectConfig = {
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      privateKey: cfg.privateKey,
      readyTimeout: opts.timeoutMs ?? 15_000,
      keepaliveInterval: 30_000,
    };
    client
      .once("ready", () => resolve(client))
      .once("error", (err) => {
        logger.warn({ err: err.message }, "SSH connect error");
        reject(err);
      })
      .connect(connectCfg);
  });
}

/** Ejecuta un comando one-shot. Devuelve stdout, stderr y exit code. */
export async function execCommand(
  cfg: SshConnectConfig,
  command: string,
  opts: { timeoutMs?: number } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  const client = await openSshClient(cfg, { timeoutMs: opts.timeoutMs });
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        client.end();
        reject(err);
        return;
      }
      let stdout = "";
      let stderr = "";
      stream
        .on("data", (d: Buffer) => (stdout += d.toString("utf8")))
        .stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
      stream.on("close", (code: number) => {
        client.end();
        resolve({ stdout, stderr, code: code ?? -1 });
      });
    });
  });
}

/**
 * Abre un shell PTY interactivo. Devuelve el client + channel.
 * El caller debe gestionar stdin/stdout y cierre.
 */
export async function openShell(
  cfg: SshConnectConfig,
  opts: { cols?: number; rows?: number } = {}
): Promise<{ client: SshClient; channel: ClientChannel }> {
  const client = await openSshClient(cfg);
  return new Promise((resolve, reject) => {
    client.shell(
      { term: "xterm-256color", cols: opts.cols ?? 80, rows: opts.rows ?? 24 },
      (err, channel) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }
        resolve({ client, channel });
      }
    );
  });
}
