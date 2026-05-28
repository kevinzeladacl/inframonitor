import { ContainerModel } from "@inframonitor/database";
import { execCommand, getServerSshConfig } from "./ssh.service.js";
import { logger } from "../utils/logger.js";

interface DockerPsRow {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  Ports: string;
  Labels: string;
  CreatedAt?: string;
}

/**
 * Conecta por SSH a un server, ejecuta `docker ps --format '{{json .}}'`
 * y persiste/actualiza los Containers en Mongo.
 *
 * Idempotente por (serverId, containerId).
 */
export async function syncContainersFromServer(
  serverId: string
): Promise<{ synced: number; added: number }> {
  const cfg = await getServerSshConfig(serverId);
  const { stdout, code, stderr } = await execCommand(cfg, "docker ps -a --format '{{json .}}' 2>/dev/null || true", {
    timeoutMs: 20_000,
  });

  if (code !== 0 && !stdout.trim()) {
    throw new Error(`docker ps falló (code=${code}): ${stderr}`);
  }

  const lines = stdout.split("\n").filter((l) => l.trim());
  const parsed: DockerPsRow[] = lines.map((l) => {
    try {
      return JSON.parse(l) as DockerPsRow;
    } catch {
      return null;
    }
  }).filter(Boolean) as DockerPsRow[];

  let added = 0;
  for (const row of parsed) {
    const ports = parseDockerPorts(row.Ports);
    const labels = parseDockerLabels(row.Labels);

    const update = await ContainerModel.findOneAndUpdate(
      { serverId, containerId: row.ID },
      {
        $set: {
          name: row.Names.split(",")[0],
          image: row.Image,
          state: mapDockerState(row.State),
          ports,
          labels,
          composeProject: labels["com.docker.compose.project"] ?? null,
          lastSyncedAt: new Date(),
        },
        $setOnInsert: {
          serverId,
          containerId: row.ID,
        },
      },
      { upsert: true, new: false }
    );
    if (!update) added++;
  }

  // Marcar containers que ya no aparecen como "exited" (sin borrarlos)
  const aliveIds = parsed.map((p) => p.ID);
  if (aliveIds.length > 0) {
    await ContainerModel.updateMany(
      { serverId, containerId: { $nin: aliveIds }, state: "running", deletedAt: null },
      { $set: { state: "exited", lastSyncedAt: new Date() } }
    );
  }

  logger.info({ serverId, total: parsed.length, added }, "🐳 Containers sincronizados");
  return { synced: parsed.length, added };
}

function mapDockerState(s: string): "running" | "exited" | "restarting" | "paused" | "dead" | "created" {
  const lower = (s ?? "").toLowerCase();
  if (lower.includes("running") || lower.includes("up")) return "running";
  if (lower.includes("paused")) return "paused";
  if (lower.includes("restart")) return "restarting";
  if (lower.includes("dead")) return "dead";
  if (lower.includes("created")) return "created";
  return "exited";
}

function parseDockerPorts(s: string): Array<{ host?: number; container: number; proto?: "tcp" | "udp" }> {
  if (!s) return [];
  const result: Array<{ host?: number; container: number; proto?: "tcp" | "udp" }> = [];
  for (const segment of s.split(",")) {
    // "0.0.0.0:80->80/tcp" o "443/tcp"
    const m = segment.trim().match(/(?:([\d.]+):)?(\d+)?->?(\d+)\/(tcp|udp)/);
    if (m) {
      result.push({
        host: m[2] ? Number(m[2]) : undefined,
        container: Number(m[3]),
        proto: m[4] as "tcp" | "udp",
      });
    }
  }
  return result;
}

function parseDockerLabels(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const kv of s.split(",")) {
    const eq = kv.indexOf("=");
    if (eq > 0) out[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
  }
  return out;
}
