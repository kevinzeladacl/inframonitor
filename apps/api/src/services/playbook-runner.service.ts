import type { Namespace } from "socket.io";
import { PlaybookModel, PlaybookRunModel, type IPlaybook } from "@inframonitor/database";
import { execCommand, getServerSshConfig } from "./ssh.service.js";
import { logger } from "../utils/logger.js";

/**
 * Ejecuta un Playbook contra un Server vía SSH paso por paso.
 *
 * - Persiste un PlaybookRun y va actualizando `currentStepIndex` y `output`.
 * - Cada step se ejecuta con su `timeoutSec`. Si el exit code != expected y
 *   `continueOnError` es false, se aborta y se marca como failed.
 * - Emite por Socket.IO al `socketRoom` del run:
 *     - "step:start"   { index, name, command }
 *     - "step:output"  { index, line }
 *     - "step:end"     { index, code, ok, ms }
 *     - "run:done"     { success }
 *     - "run:error"    { message }
 */
export async function runPlaybook(
  playbookSlug: string,
  serverId: string,
  triggeredBy: string,
  nsp?: Namespace
): Promise<{ runId: string; socketRoom: string }> {
  const playbook = await PlaybookModel.findOne({ slug: playbookSlug, deletedAt: null });
  if (!playbook) throw new Error(`Playbook ${playbookSlug} no existe`);

  const socketRoom = `run:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const run = await PlaybookRunModel.create({
    playbookId: playbook.id,
    serverId,
    triggeredBy,
    status: "pending",
    socketRoom,
  });

  // Ejecución asíncrona — no bloquea la respuesta HTTP.
  executePlaybook(playbook, serverId, run.id, socketRoom, nsp).catch((err) => {
    logger.error({ err, runId: run.id }, "playbook runner crashed");
  });

  return { runId: run.id, socketRoom };
}

async function executePlaybook(
  playbook: IPlaybook,
  serverId: string,
  runId: string,
  socketRoom: string,
  nsp?: Namespace
): Promise<void> {
  const emit = (event: string, payload: unknown) => {
    if (nsp) nsp.to(socketRoom).emit(event, payload);
  };

  await PlaybookRunModel.updateOne({ id: runId }, { $set: { status: "running", startedAt: new Date() } });

  let cfg;
  try {
    cfg = await getServerSshConfig(serverId);
  } catch (err: any) {
    await PlaybookRunModel.updateOne(
      { id: runId },
      { $set: { status: "failed", finishedAt: new Date(), errorMessage: err?.message ?? String(err) } }
    );
    emit("run:error", { message: err?.message });
    return;
  }

  let outputAccum = "";
  for (let i = 0; i < playbook.steps.length; i++) {
    const step = playbook.steps[i];
    emit("step:start", { index: i, name: step.name, command: step.command });
    const t0 = Date.now();

    try {
      const { stdout, stderr, code } = await execCommand(cfg, step.command, {
        timeoutMs: (step.timeoutSec ?? 300) * 1000,
      });
      const combined = `\n--- ${step.name} (exit=${code}) ---\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`;
      outputAccum += combined;
      const truncated = outputAccum.slice(-20_000);
      await PlaybookRunModel.updateOne(
        { id: runId },
        { $set: { currentStepIndex: i, output: truncated } }
      );

      for (const line of (stdout + (stderr ? "\n" + stderr : "")).split("\n")) {
        if (line.trim()) emit("step:output", { index: i, line });
      }

      const expected = step.expectedExitCode ?? 0;
      const ok = code === expected;
      emit("step:end", { index: i, code, ok, ms: Date.now() - t0 });

      if (!ok && !step.continueOnError) {
        await PlaybookRunModel.updateOne(
          { id: runId },
          {
            $set: {
              status: "failed",
              finishedAt: new Date(),
              errorMessage: `Step "${step.name}" exit=${code} (esperado ${expected})`,
            },
          }
        );
        emit("run:error", { message: `Step "${step.name}" falló con exit=${code}` });
        return;
      }
    } catch (err: any) {
      await PlaybookRunModel.updateOne(
        { id: runId },
        {
          $set: {
            status: "failed",
            finishedAt: new Date(),
            errorMessage: err?.message ?? String(err),
          },
        }
      );
      emit("run:error", { message: err?.message });
      return;
    }
  }

  await PlaybookRunModel.updateOne(
    { id: runId },
    { $set: { status: "success", finishedAt: new Date() } }
  );
  emit("run:done", { success: true });
}
