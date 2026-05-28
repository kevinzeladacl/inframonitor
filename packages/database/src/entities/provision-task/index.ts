import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { provisionTaskSchema, type IProvisionTask } from "./schema.js";

export const ProvisionTaskModel: Model<IProvisionTask> =
  (models.ProvisionTask as Model<IProvisionTask>) ||
  model<IProvisionTask>("ProvisionTask", provisionTaskSchema);

export type { IProvisionTask };
