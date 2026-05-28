import { z } from "zod";
import { ProjectModel } from "@inframonitor/database";
import { makeCrudRouter } from "../services/crud.factory.js";

const baseFields = {
  name: z.string().trim().min(1),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/),
  repoUrl: z.string().url().nullish(),
  description: z.string().nullish(),
  ownerClientId: z.string().nullish(),
  colorHex: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .default("#6366f1"),
};

const createSchema = z.object(baseFields);
const updateSchema = z.object(baseFields).partial();

export const projectsRouter = makeCrudRouter({
  model: ProjectModel,
  createSchema,
  updateSchema,
  name: "Proyecto",
  listFilter: (q) => {
    const f: Record<string, unknown> = {};
    if (q.ownerClientId) f.ownerClientId = q.ownerClientId;
    return f;
  },
});
