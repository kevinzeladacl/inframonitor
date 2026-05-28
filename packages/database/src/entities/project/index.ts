import mongoose, { type Model } from "mongoose";
const { model, models } = mongoose;
import { projectSchema, type IProject } from "./schema.js";

export const ProjectModel: Model<IProject> =
  (models.Project as Model<IProject>) || model<IProject>("Project", projectSchema);

export type { IProject };
