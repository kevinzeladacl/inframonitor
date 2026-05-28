import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { playbookSchema, type IPlaybook } from "./schema.js";

export const PlaybookModel: Model<IPlaybook> =
  (models.Playbook as Model<IPlaybook>) ||
  model<IPlaybook>("Playbook", playbookSchema);

export type { IPlaybook };
