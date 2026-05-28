import { CloudSourceModel, ServerModel } from "@inframonitor/database";
import { decryptJson } from "../utils/crypto.js";
import { getProviderAdapter, type ProviderCredentials } from "../providers/index.js";
import { logger } from "../utils/logger.js";

export async function getDecryptedCredentials(cloudSourceId: string): Promise<ProviderCredentials> {
  const cs = await CloudSourceModel.findOne({ id: cloudSourceId, deletedAt: null });
  if (!cs) throw new Error(`CloudSource ${cloudSourceId} no existe`);
  return decryptJson<ProviderCredentials>(cs.credentials as any);
}

export async function getAdapter(cloudSourceId: string) {
  const creds = await getDecryptedCredentials(cloudSourceId);
  return getProviderAdapter(creds);
}

export async function verifyCloudSource(cloudSourceId: string) {
  const adapter = await getAdapter(cloudSourceId);
  const result = await adapter.verify();
  await CloudSourceModel.updateOne(
    { id: cloudSourceId },
    {
      $set: {
        verifiedAt: result.ok ? new Date() : null,
        lastError: result.ok ? null : result.error ?? "Verificación falló",
      },
    }
  );
  return result;
}

export async function importServers(cloudSourceId: string): Promise<{ imported: number; updated: number }> {
  const cs = await CloudSourceModel.findOne({ id: cloudSourceId, deletedAt: null });
  if (!cs) throw new Error("CloudSource no existe");
  const adapter = await getAdapter(cloudSourceId);
  const instances = await adapter.listInstances();

  let imported = 0;
  let updated = 0;

  for (const inst of instances) {
    const existing = await ServerModel.findOne({
      cloudSourceId,
      providerInstanceId: inst.providerInstanceId,
    });
    if (existing) {
      existing.set({
        name: inst.name,
        region: inst.region,
        availabilityZone: inst.availabilityZone,
        publicIp: inst.publicIp,
        privateIp: inst.privateIp,
        os: inst.os,
        status: inst.status,
        specs: inst.specs,
        costEstimate: inst.costEstimate
          ? { ...inst.costEstimate, lastCalculatedAt: new Date() }
          : existing.costEstimate,
        tags: inst.tags ?? existing.tags,
        lastSeenAt: new Date(),
      });
      await existing.save();
      updated++;
    } else {
      await ServerModel.create({
        name: inst.name,
        cloudSourceId,
        provider: cs.provider,
        providerInstanceId: inst.providerInstanceId,
        region: inst.region,
        availabilityZone: inst.availabilityZone,
        publicIp: inst.publicIp,
        privateIp: inst.privateIp,
        os: inst.os,
        specs: inst.specs,
        status: inst.status,
        bootstrapStatus: "skipped",
        tags: inst.tags ?? [],
        costEstimate: inst.costEstimate
          ? { ...inst.costEstimate, lastCalculatedAt: new Date() }
          : undefined,
        provisionedAt: new Date(),
        lastSeenAt: new Date(),
        ssh: { user: "root", port: 22 },
      });
      imported++;
    }
  }
  logger.info({ cloudSourceId, imported, updated }, "🔄 Import completado");
  return { imported, updated };
}
