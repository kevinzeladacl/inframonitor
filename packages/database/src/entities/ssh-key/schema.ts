import { Schema } from "mongoose";
import {
  encryptedCredentialsSchema,
  type IEncryptedCredentials,
} from "../../shared/encrypted-credentials.schema.js";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

export interface ISshKey {
  id: string;
  name: string;
  publicKey: string; // ssh-rsa AAAA…
  privateKeyEncrypted: IEncryptedCredentials;
  fingerprint: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const sshKeySchema = new Schema<ISshKey>(
  {
    name: { type: String, required: true, trim: true },
    publicKey: { type: String, required: true },
    privateKeyEncrypted: { type: encryptedCredentialsSchema, required: true },
    fingerprint: { type: String, required: true, unique: true, index: true },
  },
  baseSchemaOptions
);

sshKeySchema.set("toJSON", {
  ...baseSchemaOptions.toJSON,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    delete r._id;
    delete r.privateKeyEncrypted;
    return r;
  },
});

applyBaseSchema(sshKeySchema);
