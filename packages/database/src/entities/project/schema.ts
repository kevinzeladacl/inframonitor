import { Schema } from "mongoose";
import { applyBaseSchema, baseSchemaOptions, colorHexField } from "../../shared/base.js";

export interface IProject {
  id: string;
  name: string;
  slug: string;
  repoUrl?: string | null;
  description?: string | null;
  ownerClientId?: string | null;
  colorHex?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    repoUrl: { type: String, default: null },
    description: { type: String, default: null },
    ownerClientId: { type: String, default: null, index: true },
    colorHex: { ...colorHexField, default: "#6366f1" },
  },
  baseSchemaOptions
);

applyBaseSchema(projectSchema);
