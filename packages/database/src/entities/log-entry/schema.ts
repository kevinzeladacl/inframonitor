import { Schema } from "mongoose";
import type { LogLevel, LogSource } from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

/**
 * Buffer rotativo de 24 h.
 *
 * El TTL index sobre `ts` con `expireAfterSeconds: 86400` deja que Mongo
 * elimine entradas viejas solo, sin cron propio. Tail real-time se hace
 * solo cuando hay suscriptor en el namespace /logs (ver apps/api/src/sockets).
 */
export interface ILogEntry {
  id: string;
  serverId: string;
  containerId?: string | null;
  source: LogSource;
  level: LogLevel;
  message: string;
  ts: Date;
  streamId?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const logEntrySchema = new Schema<ILogEntry>(
  {
    serverId: { type: String, required: true },
    containerId: { type: String, default: null },
    source: {
      type: String,
      required: true,
      enum: ["docker", "syslog", "playbook", "ssh"],
      default: "syslog",
    },
    level: {
      type: String,
      required: true,
      enum: ["debug", "info", "warn", "error"],
      default: "info",
    },
    message: { type: String, required: true },
    ts: { type: Date, required: true, default: () => new Date() },
    streamId: { type: String, default: null },
  },
  baseSchemaOptions
);

// TTL: borra entradas con `ts` mayor a 24h.
logEntrySchema.index({ ts: 1 }, { expireAfterSeconds: 86_400 });
// Acceso por server/contenedor ordenado descendente.
logEntrySchema.index({ serverId: 1, ts: -1 });
logEntrySchema.index({ containerId: 1, ts: -1 });

applyBaseSchema(logEntrySchema);
