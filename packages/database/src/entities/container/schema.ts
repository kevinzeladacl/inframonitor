import { Schema } from "mongoose";
import type { ContainerState } from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

export interface IContainerPort {
  host?: number;
  container: number;
  proto?: "tcp" | "udp";
}

export interface IContainerStats {
  cpuPercent?: number;
  memMb?: number;
  netRxBytes?: number;
  netTxBytes?: number;
  takenAt?: Date;
}

export interface IContainer {
  id: string;
  serverId: string;
  /** sha del contenedor en docker */
  containerId: string;
  name: string;
  image: string;
  state: ContainerState;
  ports: IContainerPort[];
  labels: Record<string, string>;
  composeProject?: string | null;
  /** Asignación lógica (manual desde UI) */
  environmentId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  lastSyncedAt?: Date | null;
  statsSnapshot?: IContainerStats;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const portSchema = new Schema<IContainerPort>(
  {
    host: Number,
    container: { type: Number, required: true },
    proto: { type: String, enum: ["tcp", "udp"], default: "tcp" },
  },
  { _id: false }
);

const statsSchema = new Schema<IContainerStats>(
  {
    cpuPercent: Number,
    memMb: Number,
    netRxBytes: Number,
    netTxBytes: Number,
    takenAt: Date,
  },
  { _id: false }
);

export const containerSchema = new Schema<IContainer>(
  {
    serverId: { type: String, required: true, index: true },
    containerId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    state: {
      type: String,
      required: true,
      enum: ["running", "exited", "restarting", "paused", "dead", "created"],
      default: "running",
      index: true,
    },
    ports: { type: [portSchema], default: [] },
    labels: { type: Schema.Types.Mixed, default: {} },
    composeProject: { type: String, default: null },
    environmentId: { type: String, default: null, index: true },
    projectId: { type: String, default: null, index: true },
    clientId: { type: String, default: null, index: true },
    lastSyncedAt: { type: Date, default: null },
    statsSnapshot: { type: statsSchema, default: null },
  },
  baseSchemaOptions
);

containerSchema.index({ serverId: 1, containerId: 1 }, { unique: true });

applyBaseSchema(containerSchema);
