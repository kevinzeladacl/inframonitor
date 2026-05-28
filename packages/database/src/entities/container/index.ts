import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { containerSchema, type IContainer } from "./schema.js";

export const ContainerModel: Model<IContainer> =
  (models.Container as Model<IContainer>) ||
  model<IContainer>("Container", containerSchema);

export type { IContainer };
