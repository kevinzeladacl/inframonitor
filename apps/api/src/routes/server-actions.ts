import { Router } from "express";
import { ServerModel } from "@inframonitor/database";
import { syncContainersFromServer } from "../services/docker-sync.service.js";
import { getServerSshConfig, execCommand } from "../services/ssh.service.js";
import { getDecryptedCredentials } from "../services/cloud-source.service.js";
import { getProviderAdapter } from "../providers/index.js";

export const serverActionsRouter = Router();

/** POST /servers/:id/sync-containers — corre docker ps por SSH y persiste */
serverActionsRouter.post("/:id/sync-containers", async (req, res, next) => {
  try {
    const result = await syncContainersFromServer(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: { code: "SYNC_FAILED", message: err?.message ?? String(err) } });
  }
});

/** POST /servers/:id/ssh/test — verifica que se puede conectar y devuelve uname -a */
serverActionsRouter.post("/:id/ssh/test", async (req, res, next) => {
  try {
    const cfg = await getServerSshConfig(req.params.id);
    const { stdout, code, stderr } = await execCommand(cfg, "uname -a", { timeoutMs: 10_000 });
    res.json({ ok: code === 0, stdout, stderr, code });
  } catch (err: any) {
    res.status(500).json({ error: { code: "SSH_TEST_FAILED", message: err?.message ?? String(err) } });
  }
});

/** POST /servers/:id/start — power on en el provider */
serverActionsRouter.post("/:id/start", async (req, res, next) => {
  try {
    const server = await ServerModel.findOne({ id: req.params.id, deletedAt: null });
    if (!server || !server.cloudSourceId || !server.providerInstanceId) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Server o provider data faltante" } });
      return;
    }
    const creds = await getDecryptedCredentials(server.cloudSourceId);
    const adapter = getProviderAdapter(creds);
    if (!adapter.startInstance) {
      res.status(400).json({ error: { code: "NOT_SUPPORTED", message: `${creds.provider} no expone start` } });
      return;
    }
    await adapter.startInstance(server.providerInstanceId, server.region);
    server.status = "running";
    await server.save();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: "START_FAILED", message: err?.message ?? String(err) } });
  }
});

serverActionsRouter.post("/:id/stop", async (req, res, next) => {
  try {
    const server = await ServerModel.findOne({ id: req.params.id, deletedAt: null });
    if (!server || !server.cloudSourceId || !server.providerInstanceId) {
      res.status(404).json({ error: { code: "NOT_FOUND" } });
      return;
    }
    const creds = await getDecryptedCredentials(server.cloudSourceId);
    const adapter = getProviderAdapter(creds);
    if (!adapter.stopInstance) {
      res.status(400).json({ error: { code: "NOT_SUPPORTED" } });
      return;
    }
    await adapter.stopInstance(server.providerInstanceId, server.region);
    server.status = "stopped";
    await server.save();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: "STOP_FAILED", message: err?.message ?? String(err) } });
  }
});

/** POST /servers/:id/terminate?force=1 — destruye la VM en el provider */
serverActionsRouter.post("/:id/terminate", async (req, res, next) => {
  try {
    if (req.query.force !== "1") {
      res.status(400).json({ error: { code: "MISSING_FORCE", message: "Agrega ?force=1 para confirmar" } });
      return;
    }
    const server = await ServerModel.findOne({ id: req.params.id, deletedAt: null });
    if (!server || !server.cloudSourceId || !server.providerInstanceId) {
      res.status(404).json({ error: { code: "NOT_FOUND" } });
      return;
    }
    const creds = await getDecryptedCredentials(server.cloudSourceId);
    const adapter = getProviderAdapter(creds);
    await adapter.terminateInstance(server.providerInstanceId, server.region);
    server.status = "terminated";
    server.deletedAt = new Date();
    await server.save();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: "TERMINATE_FAILED", message: err?.message ?? String(err) } });
  }
});
