import { Schema } from "mongoose";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

export interface IAuditLog {
  id: string;
  userId: string;
  action: string; // ej. "cloud-source.verify", "server.terminate", "credentials.access"
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ts: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, default: null, index: true },
    entityId: { type: String, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ts: { type: Date, required: true, default: () => new Date(), index: true },
  },
  baseSchemaOptions
);

applyBaseSchema(auditLogSchema);
