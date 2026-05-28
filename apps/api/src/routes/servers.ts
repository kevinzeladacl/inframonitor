import { z } from "zod";
import { ServerModel } from "@inframonitor/database";
import { makeCrudRouter } from "../services/crud.factory.js";

const specsSchema = z
  .object({
    cpu: z.number().int().positive().optional(),
    ramMb: z.number().int().positive().optional(),
    diskGb: z.number().int().positive().optional(),
    instanceType: z.string().optional(),
  })
  .partial();

const sshSchema = z
  .object({
    user: z.string().default("root"),
    port: z.number().int().min(1).max(65535).default(22),
    keyId: z.string().nullish(),
    hostFingerprint: z.string().nullish(),
  })
  .partial();

const baseFields = {
  name: z.string().trim().min(1),
  cloudSourceId: z.string().min(1),
  provider: z.enum(["aws", "digitalocean", "azure"]),
  providerInstanceId: z.string().nullish(),
  region: z.string().min(1),
  availabilityZone: z.string().nullish(),
  publicIp: z.string().nullish(),
  privateIp: z.string().nullish(),
  os: z.string().nullish(),
  specs: specsSchema.optional(),
  status: z
    .enum(["provisioning", "running", "stopped", "terminated", "error"])
    .default("running"),
  bootstrapStatus: z
    .enum(["pending", "running", "done", "failed", "skipped"])
    .default("pending"),
  tags: z.array(z.string()).default([]),
  costEstimate: z
    .object({
      hourlyUsd: z.number().nonnegative().optional(),
      monthlyUsd: z.number().nonnegative().optional(),
    })
    .optional(),
  ssh: sshSchema.optional(),
};

const createSchema = z.object(baseFields);
const updateSchema = z.object(baseFields).partial();

export const serversRouter = makeCrudRouter({
  model: ServerModel,
  createSchema,
  updateSchema,
  name: "Servidor",
  listFilter: (q) => {
    const f: Record<string, unknown> = {};
    if (q.cloudSourceId) f.cloudSourceId = q.cloudSourceId;
    if (q.provider) f.provider = q.provider;
    if (q.status) f.status = q.status;
    return f;
  },
});
