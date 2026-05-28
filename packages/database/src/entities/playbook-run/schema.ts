import { Schema } from "mongoose";
import type { RunStatus } from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

export interface IPlaybookRun {
  id: string;
  playbookId: string;
  serverId: string;
  triggeredBy: string; // userId
  status: RunStatus;
  currentStepIndex: number;
  /** Salida truncada (últimos N KB). El stream completo va por socket. */
  output: string;
  /** Room de Socket.IO para suscribirse al stream */
  socketRoom: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  errorMessage?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const playbookRunSchema = new Schema<IPlaybookRun>(
  {
    playbookId: { type: String, required: true, index: true },
    serverId: { type: String, required: true, index: true },
    triggeredBy: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "running", "success", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    currentStepIndex: { type: Number, default: 0 },
    output: { type: String, default: "" },
    socketRoom: { type: String, required: true, index: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    errorMessage: { type: String, default: null },
  },
  baseSchemaOptions
);

applyBaseSchema(playbookRunSchema);
