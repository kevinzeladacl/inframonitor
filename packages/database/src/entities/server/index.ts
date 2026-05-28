import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { serverSchema, type IServer } from "./schema.js";

export const ServerModel: Model<IServer> =
  (models.Server as Model<IServer>) || model<IServer>("Server", serverSchema);

export type { IServer };
