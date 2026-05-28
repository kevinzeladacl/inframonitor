import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { playbookRunSchema, type IPlaybookRun } from "./schema.js";

export const PlaybookRunModel: Model<IPlaybookRun> =
  (models.PlaybookRun as Model<IPlaybookRun>) ||
  model<IPlaybookRun>("PlaybookRun", playbookRunSchema);

export type { IPlaybookRun };
