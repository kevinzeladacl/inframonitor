import { Router, type Request } from "express";
import { z } from "zod";
import { PlaybookModel, PlaybookRunModel } from "@inframonitor/database";
import { runPlaybook } from "../services/playbook-runner.service.js";
import { ioRef } from "../sockets/registry.js";
import type { AuthedRequest } from "../middleware/auth.js";

export const playbooksRouter = Router();

const stepSchema = z.object({
  name: z.string(),
  command: z.string(),
  expectedExitCode: z.number().int().optional(),
  timeoutSec: z.number().int().positive().optional(),
  continueOnError: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/),
  description: z.string().nullish(),
  kind: z.enum(["shell", "compose", "composite"]).default("shell"),
  steps: z.array(stepSchema).default([]),
  requires: z.object({ os: z.string().optional(), minRamMb: z.number().int().optional() }).optional(),
});
const updateSchema = createSchema.partial();

playbooksRouter.get("/", async (_req, res, next) => {
  try {
    const items = await PlaybookModel.find({ deletedAt: null }).sort({ isBuiltin: -1, name: 1 }).lean();
    res.json({
      items: items.map(({ _id, __v, ...rest }: any) => {
        void _id; void __v;
        return rest;
      }),
    });
  } catch (err) {
    next(err);
  }
});

playbooksRouter.get("/:slug", async (req, res, next) => {
  try {
    const item = await PlaybookModel.findOne({ slug: req.params.slug, deletedAt: null });
    if (!item) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Playbook no existe" } });
      return;
    }
    res.json(item.toJSON());
  } catch (err) {
    next(err);
  }
});

playbooksRouter.post("/", async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const doc = await PlaybookModel.create({ ...data, isBuiltin: false, version: 1 });
    res.status(201).json(doc.toJSON());
  } catch (err) {
    next(err);
  }
});

playbooksRouter.patch("/:slug", async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const doc = await PlaybookModel.findOneAndUpdate(
      { slug: req.params.slug, deletedAt: null, isBuiltin: false },
      { $set: data, $inc: { version: 1 } },
      { new: true }
    );
    if (!doc) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Playbook no existe o es built-in" } });
      return;
    }
    res.json(doc.toJSON());
  } catch (err) {
    next(err);
  }
});

playbooksRouter.delete("/:slug", async (req, res, next) => {
  try {
    const doc = await PlaybookModel.findOneAndUpdate(
      { slug: req.params.slug, deletedAt: null, isBuiltin: false },
      { $set: { deletedAt: new Date() } }
    );
    if (!doc) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Playbook no existe o es built-in" } });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** POST /playbooks/:slug/run-on/:serverId — dispara una ejecución async */
playbooksRouter.post("/:slug/run-on/:serverId", async (req: Request, res, next) => {
  try {
    const userId = (req as AuthedRequest).user?.sub ?? "unknown";
    const provisionNsp = ioRef.get()?.of("/provision");
    const result = await runPlaybook(req.params.slug, req.params.serverId, userId, provisionNsp);
    res.status(202).json(result);
  } catch (err: any) {
    res.status(500).json({ error: { code: "RUN_FAILED", message: err?.message ?? String(err) } });
  }
});

playbooksRouter.get("/runs/:id", async (req, res, next) => {
  try {
    const run = await PlaybookRunModel.findOne({ id: req.params.id });
    if (!run) {
      res.status(404).json({ error: { code: "NOT_FOUND" } });
      return;
    }
    res.json(run.toJSON());
  } catch (err) {
    next(err);
  }
});
