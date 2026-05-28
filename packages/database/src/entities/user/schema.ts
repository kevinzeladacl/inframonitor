import { Schema } from "mongoose";
import type { UserRole } from "@inframonitor/shared-types";
import { applyBaseSchema, baseSchemaOptions } from "../../shared/base.js";

export interface IUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  lastLoginAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, default: "owner" },
    lastLoginAt: { type: Date, default: null },
  },
  baseSchemaOptions
);

// passwordHash nunca sale por API.
userSchema.set("toJSON", {
  ...baseSchemaOptions.toJSON,
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    delete r._id;
    delete r.passwordHash;
    return r;
  },
});

applyBaseSchema(userSchema);
