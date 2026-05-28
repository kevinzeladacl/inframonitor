import { Router, type Request } from "express";
import { z } from "zod";
import { ProvisionTaskModel, ServerModel } from "@inframonitor/database";
import { startProvision } from "../services/provision.service.js";
import { ioRef } from "../sockets/registry.js";
import { getDecryptedCredentials } from "../services/cloud-source.service.js";
import { getProviderAdapter } from "../providers/index.js";
import type { AuthedRequest } from "../middleware/auth.js";

export const provisionRouter = Router();

const wizardSchema = z.object({
  cloudSourceId: z.string().min(1),
  name: z.string().trim().min(1),
  region: z.string().min(1),
  size: z.string().min(1),
  os: z.string().min(1),
  playbookSlug: z.string().optional(),
  sshKeyId: z.string().optional(),
});

/** POST /provision/preview — devuelve costo estimado */
provisionRouter.post("/preview", async (req, res, next) => {
  try {
    const data = wizardSchema.parse(req.body);
    const creds = await getDecryptedCredentials(data.cloudSourceId);
    const adapter = getProviderAdapter(creds);
    const sizes = await adapter.listSizes(data.region);
    const sizeInfo = sizes.find((s) => s.slug === data.size);
    const hourlyUsd = sizeInfo?.hourlyUsd ?? 0;
    res.json({
      hourlyUsd,
      monthlyUsd: hourlyUsd ? hourlyUsd * 730 : 0,
      sizeInfo,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "PREVIEW_FAILED", message: err?.message ?? String(err) } });
  }
});

/** POST /provision/start — dispara la creación async */
provisionRouter.post("/start", async (req: Request, res, next) => {
  try {
    const data = wizardSchema.parse(req.body);
    const userId = (req as AuthedRequest).user?.sub ?? "unknown";
    const nsp = ioRef.get()?.of("/provision");
    const result = await startProvision(userId, data, nsp);
    res.status(202).json(result);
  } catch (err: any) {
    res.status(500).json({ error: { code: "PROVISION_FAILED", message: err?.message ?? String(err) } });
  }
});

provisionRouter.get("/tasks/:id", async (req, res, next) => {
  try {
    const task = await ProvisionTaskModel.findOne({ id: req.params.id });
    if (!task) {
      res.status(404).json({ error: { code: "NOT_FOUND" } });
      return;
    }
    res.json(task.toJSON());
  } catch (err) {
    next(err);
  }
});

/** POST /provision/tasks/:id/cancel — termina VM si ya se creó, marca cancelled */
provisionRouter.post("/tasks/:id/cancel", async (req, res, next) => {
  try {
    const task = await ProvisionTaskModel.findOne({ id: req.params.id });
    if (!task) {
      res.status(404).json({ error: { code: "NOT_FOUND" } });
      return;
    }
    if (task.serverId) {
      const server = await ServerModel.findOne({ id: task.serverId });
      if (server?.providerInstanceId) {
        try {
          const creds = await getDecryptedCredentials(task.cloudSourceId);
          const adapter = getProviderAdapter(creds);
          await adapter.terminateInstance(server.providerInstanceId, server.region);
          server.status = "terminated";
          server.deletedAt = new Date();
          await server.save();
        } catch {
          // best effort
        }
      }
    }
    task.status = "cancelled";
    task.finishedAt = new Date();
    await task.save();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: "CANCEL_FAILED", message: err?.message ?? String(err) } });
  }
});
