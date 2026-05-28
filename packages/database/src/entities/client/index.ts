import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { clientSchema, type IClient } from "./schema.js";

export const ClientModel: Model<IClient> =
  (models.Client as Model<IClient>) || model<IClient>("Client", clientSchema);

export type { IClient };
