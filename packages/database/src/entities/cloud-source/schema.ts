import { Schema } from "mongoose";
import type { Provider } from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";
import {
  encryptedCredentialsSchema,
  type IEncryptedCredentials,
} from "../../shared/encrypted-credentials.schema.js";

export interface ICloudSource {
  id: string;
  name: string;
  provider: Provider;
  /** Cifrado libsodium. No se serializa por API. */
  credentials: IEncryptedCredentials;
  defaultRegion?: string;
  verifiedAt?: Date | null;
  lastError?: string | null;
  enabled: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const cloudSourceSchema = new Schema<ICloudSource>(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, required: true, enum: ["aws", "digitalocean", "azure"], index: true },
    credentials: { type: encryptedCredentialsSchema, required: true },
    defaultRegion: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    enabled: { type: Boolean, default: true },
  },
  baseSchemaOptions
);

// `credentials` se omite SIEMPRE de respuestas API.
cloudSourceSchema.set("toJSON", {
  ...baseSchemaOptions.toJSON,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    delete r._id;
    delete r.credentials;
    return r;
  },
});

applyBaseSchema(cloudSourceSchema);
