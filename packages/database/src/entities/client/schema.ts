import { Schema } from "mongoose";
import type { ClientType } from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions, colorHexField } from "../../shared/base.js";

/**
 * "Cliente" en el sentido de deploy/tenant final.
 * Ej. "Isla de Maipo", "Muni Providencia", "Demo".
 * Un cliente USA recursos (containers, servers); no los posee técnicamente.
 */
export interface IClient {
  id: string;
  name: string;
  type: ClientType;
  contactEmail?: string | null;
  notes?: string | null;
  colorHex?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const clientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["municipality", "internal", "external", "demo"],
      default: "external",
      index: true,
    },
    contactEmail: { type: String, default: null, lowercase: true, trim: true },
    notes: { type: String, default: null },
    colorHex: { ...colorHexField, default: "#10b981" },
  },
  baseSchemaOptions
);

applyBaseSchema(clientSchema);
