import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { auditLogSchema, type IAuditLog } from "./schema.js";

export const AuditLogModel: Model<IAuditLog> =
  (models.AuditLog as Model<IAuditLog>) ||
  model<IAuditLog>("AuditLog", auditLogSchema);

export type { IAuditLog };
