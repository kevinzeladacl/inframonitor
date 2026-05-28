import { Schema } from "mongoose";
import type {
  Provider,
  ServerStatus,
  BootstrapStatus,
} from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

export interface IServerSpecs {
  cpu?: number;
  ramMb?: number;
  diskGb?: number;
  instanceType?: string;
}

export interface IServerCost {
  hourlyUsd?: number;
  monthlyUsd?: number;
  lastCalculatedAt?: Date | null;
}

export interface IServerSshConfig {
  user: string; // ej. "root", "ubuntu"
  port: number;
  /** id de SshKey asociada */
  keyId?: string;
  /** TOFU: fingerprint del host aceptado en la primera conexión */
  hostFingerprint?: string;
}

export interface IServer {
  id: string;
  name: string;
  cloudSourceId: string;
  provider: Provider;
  /** id en el provider: i-xxx (AWS), droplet id (DO), resource id (Azure) */
  providerInstanceId?: string;
  region: string;
  availabilityZone?: string;
  publicIp?: string;
  privateIp?: string;
  os?: string;
  specs: IServerSpecs;
  status: ServerStatus;
  bootstrapStatus: BootstrapStatus;
  provisionedAt?: Date | null;
  lastSeenAt?: Date | null;
  uptimeSeconds?: number;
  tags: string[];
  costEstimate: IServerCost;
  ssh: IServerSshConfig;
  /** id del Playbook con que se bootstrapeó (si aplica) */
  playbookId?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const serverSpecsSchema = new Schema<IServerSpecs>(
  {
    cpu: Number,
    ramMb: Number,
    diskGb: Number,
    instanceType: String,
  },
  { _id: false }
);

const serverCostSchema = new Schema<IServerCost>(
  {
    hourlyUsd: Number,
    monthlyUsd: Number,
    lastCalculatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const serverSshSchema = new Schema<IServerSshConfig>(
  {
    user: { type: String, required: true, default: "root" },
    port: { type: Number, required: true, default: 22 },
    keyId: { type: String, default: null },
    hostFingerprint: { type: String, default: null },
  },
  { _id: false }
);

export const serverSchema = new Schema<IServer>(
  {
    name: { type: String, required: true, trim: true, index: true },
    cloudSourceId: { type: String, required: true, index: true },
    provider: { type: String, required: true, enum: ["aws", "digitalocean", "azure"], index: true },
    providerInstanceId: { type: String, index: true, default: null },
    region: { type: String, required: true },
    availabilityZone: { type: String, default: null },
    publicIp: { type: String, default: null },
    privateIp: { type: String, default: null },
    os: { type: String, default: null },
    specs: { type: serverSpecsSchema, default: () => ({}) },
    status: {
      type: String,
      required: true,
      enum: ["provisioning", "running", "stopped", "terminated", "error"],
      default: "provisioning",
      index: true,
    },
    bootstrapStatus: {
      type: String,
      required: true,
      enum: ["pending", "running", "done", "failed", "skipped"],
      default: "pending",
    },
    provisionedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    uptimeSeconds: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    costEstimate: { type: serverCostSchema, default: () => ({}) },
    ssh: { type: serverSshSchema, default: () => ({ user: "root", port: 22 }) },
    playbookId: { type: String, default: null },
  },
  baseSchemaOptions
);

applyBaseSchema(serverSchema);
