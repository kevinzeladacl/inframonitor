import { Schema } from "mongoose";
import type { RunStatus, ProvisionPhase } from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

/**
 * Una orden de aprovisionamiento desde el wizard.
 * Hilo de vida: wizard → SDK cloud crea VM → poll → SSH ready → playbook.
 */
export interface IProvisionTask {
  id: string;
  userId: string;
  cloudSourceId: string;
  /** Snapshot crudo de las elecciones del wizard (región, tamaño, playbook, etc.) */
  wizardSnapshot: Record<string, unknown>;
  status: RunStatus;
  phase: ProvisionPhase;
  serverId?: string | null;
  playbookRunId?: string | null;
  errorMessage?: string | null;
  socketRoom: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const provisionTaskSchema = new Schema<IProvisionTask>(
  {
    userId: { type: String, required: true, index: true },
    cloudSourceId: { type: String, required: true, index: true },
    wizardSnapshot: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "running", "success", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    phase: {
      type: String,
      required: true,
      enum: ["creating-vm", "waiting-ssh", "running-playbook", "done", "error"],
      default: "creating-vm",
    },
    serverId: { type: String, default: null, index: true },
    playbookRunId: { type: String, default: null },
    errorMessage: { type: String, default: null },
    socketRoom: { type: String, required: true, index: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  baseSchemaOptions
);

applyBaseSchema(provisionTaskSchema);
