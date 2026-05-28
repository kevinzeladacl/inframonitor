import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { sshKeySchema, type ISshKey } from "./schema.js";

export const SshKeyModel: Model<ISshKey> =
  (models.SshKey as Model<ISshKey>) || model<ISshKey>("SshKey", sshKeySchema);

export type { ISshKey };
