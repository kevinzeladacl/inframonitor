import { Schema } from "mongoose";
import type { EnvName } from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

export interface IEnvironment {
  id: string;
  name: EnvName;
  projectId: string;
  urlBase?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const environmentSchema = new Schema<IEnvironment>(
  {
    name: { type: String, required: true, enum: ["dev", "staging", "prod", "qa"], index: true },
    projectId: { type: String, required: true, index: true },
    urlBase: { type: String, default: null },
  },
  baseSchemaOptions
);

environmentSchema.index({ projectId: 1, name: 1 }, { unique: true });

applyBaseSchema(environmentSchema);
