import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { environmentSchema, type IEnvironment } from "./schema.js";

export const EnvironmentModel: Model<IEnvironment> =
  (models.Environment as Model<IEnvironment>) ||
  model<IEnvironment>("Environment", environmentSchema);

export type { IEnvironment };
