import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { cloudSourceSchema, type ICloudSource } from "./schema.js";

export const CloudSourceModel: Model<ICloudSource> =
  (models.CloudSource as Model<ICloudSource>) ||
  model<ICloudSource>("CloudSource", cloudSourceSchema);

export type { ICloudSource };
