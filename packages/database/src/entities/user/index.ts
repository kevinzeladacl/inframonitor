import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { userSchema, type IUser } from "./schema.js";

export const UserModel: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", userSchema);

export type { IUser };
