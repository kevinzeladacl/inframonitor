import { Router } from "express";
import { z } from "zod";
import { CloudSourceModel } from "@inframonitor/database";
import { encryptJson } from "../utils/crypto.js";
import {
  verifyCloudSource,
  importServers,
  getAdapter,
} from "../services/cloud-source.service.js";
import type { ProviderCredentials } from "../providers/index.js";

export const cloudSourcesRouter = Router();

// ---- Schemas ----
const awsCreds = z.object({
  provider: z.literal("aws"),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  defaultRegion: z.string().min(1),
});
const doCreds = z.object({
  provider: z.literal("digitalocean"),
  token: z.string().min(1),
});
const azureCreds = z.object({
  provider: z.literal("azure"),
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  subscriptionId: z.string().min(1),
});
const credsSchema = z.discriminatedUnion("provider", [awsCreds, doCreds, azureCreds]);

const createSchema = z.object({
  name: z.string().trim().min(1),
  provider: z.enum(["aws", "digitalocean", "azure"]),
  defaultRegion: z.string().optional(),
  enabled: z.boolean().default(true),
  credentials: credsSchema,
});

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  defaultRegion: z.string().nullish(),
  enabled: z.boolean().optional(),
  credentials: credsSchema.optional(),
});

// ---- Endpoints ----

cloudSourcesRouter.get("/", async (_req, res, next) => {
  try {
    const items = await CloudSourceModel.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
    const sanitized = items.map((doc: Record<string, unknown>) => {
      const { _id, __v, credentials, ...rest } = doc as { _id: unknown; __v: unknown; credentials: unknown };
      void _id; void __v; void credentials;
      return rest;
    });
    res.json({ items: sanitized });
  } catch (err) {
    next(err);
  }
});

cloudSourcesRouter.post("/", async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const blob = await encryptJson(data.credentials as ProviderCredentials);
    const doc = await CloudSourceModel.create({
      name: data.name,
      provider: data.provider,
      defaultRegion: data.defaultRegion ?? (data.credentials as any).defaultRegion ?? null,
      enabled: data.enabled,
      credentials: blob,
    });
    res.status(201).json(doc.toJSON());
  } catch (err) {
    next(err);
  }
});

cloudSourcesRouter.get("/:id", async (req, res, next) => {
  try {
    const doc = await CloudSourceModel.findOne({ id: req.params.id, deletedAt: null });
    if (!doc) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "CloudSource no existe" } });
      return;
    }
    res.json(doc.toJSON());
  } catch (err) {
    next(err);
  }
});

cloudSourcesRouter.patch("/:id", async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.defaultRegion !== undefined) update.defaultRegion = data.defaultRegion;
    if (data.enabled !== undefined) update.enabled = data.enabled;
    if (data.credentials) {
      update.credentials = await encryptJson(data.credentials as ProviderCredentials);
      // Si cambia las credenciales hay que re-verificar
      update.verifiedAt = null;
      update.lastError = null;
    }
    const doc = await CloudSourceModel.findOneAndUpdate(
      { id: req.params.id, deletedAt: null },
      { $set: update },
      { new: true }
    );
    if (!doc) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "CloudSource no existe" } });
      return;
    }
    res.json(doc.toJSON());
  } catch (err) {
    next(err);
  }
});

cloudSourcesRouter.delete("/:id", async (req, res, next) => {
  try {
    const doc = await CloudSourceModel.findOneAndUpdate(
      { id: req.params.id, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );
    if (!doc) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "CloudSource no existe" } });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

cloudSourcesRouter.post("/:id/verify", async (req, res, next) => {
  try {
    const result = await verifyCloudSource(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

cloudSourcesRouter.post("/:id/import-servers", async (req, res, next) => {
  try {
    const result = await importServers(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: { code: "IMPORT_FAILED", message: err?.message ?? String(err) } });
  }
});

cloudSourcesRouter.get("/:id/regions", async (req, res, next) => {
  try {
    const adapter = await getAdapter(req.params.id);
    const regions = await adapter.listRegions();
    res.json({ regions });
  } catch (err: any) {
    res.status(500).json({ error: { code: "REGIONS_FAILED", message: err?.message ?? String(err) } });
  }
});

cloudSourcesRouter.get("/:id/sizes", async (req, res, next) => {
  try {
    const adapter = await getAdapter(req.params.id);
    const sizes = await adapter.listSizes(req.query.region as string | undefined);
    res.json({ sizes });
  } catch (err: any) {
    res.status(500).json({ error: { code: "SIZES_FAILED", message: err?.message ?? String(err) } });
  }
});
