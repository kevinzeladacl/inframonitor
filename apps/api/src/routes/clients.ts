import { z } from "zod";
import { ClientModel } from "@inframonitor/database";
import { makeCrudRouter } from "../services/crud.factory.js";

const baseFields = {
  name: z.string().trim().min(1),
  type: z.enum(["municipality", "internal", "external", "demo"]).default("external"),
  contactEmail: z.string().email().nullish(),
  notes: z.string().nullish(),
  colorHex: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .default("#10b981"),
};

const createSchema = z.object(baseFields);
const updateSchema = z.object(baseFields).partial();

export const clientsRouter = makeCrudRouter({
  model: ClientModel,
  createSchema,
  updateSchema,
  name: "Cliente",
  listFilter: (q) => {
    const f: Record<string, unknown> = {};
    if (q.type) f.type = q.type;
    return f;
  },
});
