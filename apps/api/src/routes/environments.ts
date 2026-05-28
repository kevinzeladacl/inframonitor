import { z } from "zod";
import { EnvironmentModel } from "@inframonitor/database";
import { makeCrudRouter } from "../services/crud.factory.js";

const baseFields = {
  name: z.enum(["dev", "staging", "prod", "qa"]),
  projectId: z.string().min(1),
  urlBase: z.string().url().nullish(),
};

const createSchema = z.object(baseFields);
const updateSchema = z.object(baseFields).partial();

export const environmentsRouter = makeCrudRouter({
  model: EnvironmentModel,
  createSchema,
  updateSchema,
  name: "Ambiente",
  listFilter: (q) => {
    const f: Record<string, unknown> = {};
    if (q.projectId) f.projectId = q.projectId;
    if (q.name) f.name = q.name;
    return f;
  },
});
