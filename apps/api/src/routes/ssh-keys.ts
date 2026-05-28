import { Router } from "express";
import { z } from "zod";
import { SshKeyModel } from "@inframonitor/database";
import { generateSshKey } from "../services/ssh-key.service.js";

export const sshKeysRouter = Router();

sshKeysRouter.get("/", async (_req, res, next) => {
  try {
    const items = await SshKeyModel.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
    const sanitized = items.map((doc: Record<string, unknown>) => {
      const { _id, __v, privateKeyEncrypted, ...rest } = doc as { _id: unknown; __v: unknown; privateKeyEncrypted: unknown };
      void _id; void __v; void privateKeyEncrypted;
      return rest;
    });
    res.json({ items: sanitized });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().trim().min(1),
});

sshKeysRouter.post("/", async (req, res, next) => {
  try {
    const { name } = createSchema.parse(req.body);
    const doc = await generateSshKey(name);
    res.status(201).json(doc.toJSON());
  } catch (err) {
    next(err);
  }
});

sshKeysRouter.delete("/:id", async (req, res, next) => {
  try {
    const doc = await SshKeyModel.findOneAndUpdate(
      { id: req.params.id, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );
    if (!doc) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "SshKey no existe" } });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
