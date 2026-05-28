import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { logEntrySchema, type ILogEntry } from "./schema.js";

export const LogEntryModel: Model<ILogEntry> =
  (models.LogEntry as Model<ILogEntry>) ||
  model<ILogEntry>("LogEntry", logEntrySchema);

export type { ILogEntry };
