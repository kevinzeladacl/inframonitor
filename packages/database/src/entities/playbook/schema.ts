import { Schema } from "mongoose";
import type { PlaybookKind } from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

export interface IPlaybookStep {
  name: string;
  command: string;
  expectedExitCode?: number;
  timeoutSec?: number;
  continueOnError?: boolean;
}

export interface IPlaybookRequires {
  os?: string;
  minRamMb?: number;
}

export interface IPlaybook {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  kind: PlaybookKind;
  steps: IPlaybookStep[];
  requires?: IPlaybookRequires;
  version: number;
  /** true para los built-in seedeados; los custom del usuario son false */
  isBuiltin: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const stepSchema = new Schema<IPlaybookStep>(
  {
    name: { type: String, required: true },
    command: { type: String, required: true },
    expectedExitCode: { type: Number, default: 0 },
    timeoutSec: { type: Number, default: 300 },
    continueOnError: { type: Boolean, default: false },
  },
  { _id: false }
);

const requiresSchema = new Schema<IPlaybookRequires>(
  {
    os: String,
    minRamMb: Number,
  },
  { _id: false }
);

export const playbookSchema = new Schema<IPlaybook>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: null },
    kind: { type: String, required: true, enum: ["shell", "compose", "composite"], default: "shell" },
    steps: { type: [stepSchema], default: [] },
    requires: { type: requiresSchema, default: () => ({}) },
    version: { type: Number, required: true, default: 1 },
    isBuiltin: { type: Boolean, required: true, default: false, index: true },
  },
  baseSchemaOptions
);

applyBaseSchema(playbookSchema);
