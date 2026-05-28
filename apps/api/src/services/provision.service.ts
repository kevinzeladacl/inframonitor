import type { Namespace } from "socket.io";
import {
  CloudSourceModel,
  ProvisionTaskModel,
  ServerModel,
  SshKeyModel,
  PlaybookModel,
} from "@inframonitor/database";
import { getDecryptedCredentials } from "./cloud-source.service.js";
import { getProviderAdapter } from "../providers/index.js";
import { generateSshKey } from "./ssh-key.service.js";
import { execCommand, getServerSshConfig } from "./ssh.service.js";
import { runPlaybook } from "./playbook-runner.service.js";
import { logger } from "../utils/logger.js";

export interface WizardPayload {
  cloudSourceId: string;
  name: string;
  region: string;
  size: string;
  os: string;
  playbookSlug?: string;
  sshKeyId?: string; // si no, se genera una nueva
}

/**
 * Lanza un ProvisionTask: crea VM via SDK, espera SSH, corre playbook si aplica.
 * Devuelve task id + socketRoom para que el frontend se suscriba.
 */
export async function startProvision(
  userId: string,
  payload: WizardPayload,
  nsp?: Namespace
): Promise<{ taskId: string; socketRoom: string }> {
  const cs = await CloudSourceModel.findOne({ id: payload.cloudSourceId, deletedAt: null });
  if (!cs) throw new Error(`CloudSource no encontrada`);

  const socketRoom = `prov:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const task = await ProvisionTaskModel.create({
    userId,
    cloudSourceId: payload.cloudSourceId,
    wizardSnapshot: payload as unknown as Record<string, unknown>,
    status: "pending",
    phase: "creating-vm",
    socketRoom,
  });

  // Ejecución asíncrona — el HTTP responde de inmediato.
  executeProvision(task.id, payload, socketRoom, nsp).catch((err) => {
    logger.error({ err, taskId: task.id }, "provision crashed");
  });

  return { taskId: task.id, socketRoom };
}

async function executeProvision(
  taskId: string,
  payload: WizardPayload,
  socketRoom: string,
  nsp?: Namespace
) {
  const emit = (event: string, data: unknown) => {
    if (nsp) nsp.to(socketRoom).emit(event, data);
  };

  const updatePhase = async (phase: string, extra?: Record<string, unknown>) => {
    await ProvisionTaskModel.updateOne({ id: taskId }, { $set: { phase, ...extra } });
    emit("phase", { phase, ...extra });
  };

  try {
    await ProvisionTaskModel.updateOne({ id: taskId }, { $set: { status: "running", startedAt: new Date() } });

    // 1. Obtener / generar SSH key
    let sshKeyId = payload.sshKeyId;
    if (!sshKeyId) {
      emit("log", { line: "🔑 Generando par de llaves ED25519...", level: "info", ts: new Date().toISOString() });
      const generated = await generateSshKey(`provision-${payload.name}`);
      sshKeyId = generated.id;
    }
    const sshKey = await SshKeyModel.findOne({ id: sshKeyId });
    if (!sshKey) throw new Error("SshKey no encontrada después de generar");

    // 2. Crear VM
    await updatePhase("creating-vm");
    emit("log", { line: `🚀 Creando ${payload.size} en ${payload.region}...`, level: "info", ts: new Date().toISOString() });
    const creds = await getDecryptedCredentials(payload.cloudSourceId);
    const adapter = getProviderAdapter(creds);

    const createResult = await adapter.createInstance({
      name: payload.name,
      region: payload.region,
      size: payload.size,
      os: payload.os,
      sshPublicKey: sshKey.publicKey,
      tags: ["inframonitor"],
    });

    // 3. Persistir Server inicial
    const cs = await CloudSourceModel.findOne({ id: payload.cloudSourceId });
    const server = await ServerModel.create({
      name: payload.name,
      cloudSourceId: payload.cloudSourceId,
      provider: cs!.provider,
      providerInstanceId: createResult.providerInstanceId,
      region: payload.region,
      publicIp: createResult.publicIp,
      privateIp: createResult.privateIp,
      os: payload.os,
      status: "provisioning",
      bootstrapStatus: "pending",
      ssh: { user: "root", port: 22, keyId: sshKeyId },
      provisionedAt: new Date(),
      lastSeenAt: new Date(),
      specs: { instanceType: payload.size },
    });

    await ProvisionTaskModel.updateOne({ id: taskId }, { $set: { serverId: server.id } });
    emit("server-created", { serverId: server.id, providerInstanceId: createResult.providerInstanceId });

    // 4. Esperar IP + SSH ready (poll hasta 5min)
    await updatePhase("waiting-ssh");
    emit("log", { line: "⏳ Esperando que SSH esté disponible...", level: "info", ts: new Date().toISOString() });

    const deadline = Date.now() + 5 * 60_000;
    let publicIp = createResult.publicIp;
    while (Date.now() < deadline) {
      if (!publicIp) {
        // Re-listInstances y buscar la nuestra
        try {
          const list = await adapter.listInstances();
          const found = list.find((i) => i.providerInstanceId === createResult.providerInstanceId);
          if (found?.publicIp) {
            publicIp = found.publicIp;
            await ServerModel.updateOne({ id: server.id }, { $set: { publicIp, privateIp: found.privateIp ?? null } });
            emit("log", { line: `🌐 IP asignada: ${publicIp}`, level: "info", ts: new Date().toISOString() });
          }
        } catch {
          // sigue intentando
        }
      }

      if (publicIp) {
        // Intentar SSH
        try {
          const cfg = await getServerSshConfig(server.id);
          await execCommand(cfg, "echo ready", { timeoutMs: 8_000 });
          emit("log", { line: "✅ SSH respondió", level: "info", ts: new Date().toISOString() });
          break;
        } catch {
          // espera
        }
      }
      await sleep(8_000);
      emit("log", { line: "  ...still waiting", level: "debug", ts: new Date().toISOString() });
    }

    if (!publicIp) throw new Error("Timeout esperando IP pública de la VM (5min)");

    await ServerModel.updateOne({ id: server.id }, { $set: { status: "running" } });

    // 5. Ejecutar playbook si pidieron uno
    if (payload.playbookSlug) {
      await updatePhase("running-playbook");
      emit("log", { line: `📜 Ejecutando playbook: ${payload.playbookSlug}`, level: "info", ts: new Date().toISOString() });
      await ServerModel.updateOne({ id: server.id }, { $set: { bootstrapStatus: "running" } });
      const playbook = await PlaybookModel.findOne({ slug: payload.playbookSlug });
      if (!playbook) throw new Error(`Playbook ${payload.playbookSlug} no existe`);
      const { runId } = await runPlaybook(payload.playbookSlug, server.id, "system-provision", nsp);
      await ProvisionTaskModel.updateOne({ id: taskId }, { $set: { playbookRunId: runId } });
      emit("playbook-started", { runId });
      // El playbook ya emite sus propios eventos al mismo nsp.
    } else {
      await ServerModel.updateOne({ id: server.id }, { $set: { bootstrapStatus: "skipped" } });
    }

    await updatePhase("done");
    await ProvisionTaskModel.updateOne(
      { id: taskId },
      { $set: { status: "success", finishedAt: new Date() } }
    );
    await ServerModel.updateOne({ id: server.id }, { $set: { bootstrapStatus: payload.playbookSlug ? "done" : "skipped" } });
    emit("done", { serverId: server.id });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    logger.error({ err, taskId }, "provision failed");
    await ProvisionTaskModel.updateOne(
      { id: taskId },
      { $set: { status: "failed", phase: "error", finishedAt: new Date(), errorMessage: msg } }
    );
    emit("error", { message: msg });
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
