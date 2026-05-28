import { z } from "zod";
import { ContainerModel } from "@inframonitor/database";
import { makeCrudRouter } from "../services/crud.factory.js";

const portSchema = z.object({
  host: z.number().int().min(1).max(65535).optional(),
  container: z.number().int().min(1).max(65535),
  proto: z.enum(["tcp", "udp"]).default("tcp"),
});

const baseFields = {
  serverId: z.string().min(1),
  containerId: z.string().min(1),
  name: z.string().trim().min(1),
  image: z.string().min(1),
  state: z
    .enum(["running", "exited", "restarting", "paused", "dead", "created"])
    .default("running"),
  ports: z.array(portSchema).default([]),
  labels: z.record(z.string()).default({}),
  composeProject: z.string().nullish(),
  environmentId: z.string().nullish(),
  projectId: z.string().nullish(),
  clientId: z.string().nullish(),
};

const createSchema = z.object(baseFields);
const updateSchema = z.object(baseFields).partial();

export const containersRouter = makeCrudRouter({
  model: ContainerModel,
  createSchema,
  updateSchema,
  name: "Contenedor",
  listFilter: (q) => {
    const f: Record<string, unknown> = {};
    if (q.serverId) f.serverId = q.serverId;
    if (q.environmentId) f.environmentId = q.environmentId;
    if (q.projectId) f.projectId = q.projectId;
    if (q.clientId) f.clientId = q.clientId;
    if (q.state) f.state = q.state;
    return f;
  },
});
