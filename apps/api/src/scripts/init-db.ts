/**
 * init-db — Seed de demostración para Fase 1.
 *
 * Inserta de forma idempotente (upsert por slug/email/nombre):
 *   - 1 User owner (email = OWNER_EMAIL, pass = OWNER_PASSWORD)
 *   - 1 CloudSource mock DigitalOcean (credenciales placeholder)
 *   - 1 Project + 1 Environment "prod"
 *   - 1 Server con 2 Containers
 *   - 1 Client "Demo" asignado a los 2 containers
 *   - Built-in Playbooks (install-docker, install-docker-traefik)
 *
 * Ejecutar con: `pnpm dev:init` o `pnpm --filter @inframonitor/api run init-db`.
 */
import "../env-loader.js";

import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import {
  UserModel,
  CloudSourceModel,
  ServerModel,
  ContainerModel,
  EnvironmentModel,
  ProjectModel,
  ClientModel,
  PlaybookModel,
} from "@inframonitor/database";

import { connectMongo, disconnectMongo } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

async function seedOwner() {
  const exists = await UserModel.findOne({ email: env.OWNER_EMAIL }).lean();
  if (exists) {
    logger.info({ email: env.OWNER_EMAIL }, "👤 Usuario owner ya existe");
    return exists.id;
  }
  const passwordHash = await bcrypt.hash(env.OWNER_PASSWORD, 10);
  const created = await UserModel.create({
    email: env.OWNER_EMAIL,
    passwordHash,
    role: "owner",
  });
  logger.info({ email: env.OWNER_EMAIL }, "👤 Usuario owner creado");
  return created.id;
}

async function seedCloudSource() {
  const existing = await CloudSourceModel.findOne({ name: "Demo DO" }).lean();
  if (existing) return existing.id;
  const created = await CloudSourceModel.create({
    name: "Demo DO",
    provider: "digitalocean",
    defaultRegion: "nyc3",
    enabled: true,
    // Placeholder Fase 1: en Fase 3 esto se cifra con libsodium.
    credentials: {
      ciphertext: "PLACEHOLDER",
      nonce: "PLACEHOLDER",
      keyId: "v0",
    },
  });
  logger.info("☁️  CloudSource 'Demo DO' creada");
  return created.id;
}

async function seedTopology(cloudSourceId: string) {
  // Project + Environment
  const project = await ProjectModel.findOneAndUpdate(
    { slug: "demo-app" },
    {
      $setOnInsert: {
        name: "Demo App",
        slug: "demo-app",
        description: "Proyecto de demostración para Fase 1",
        colorHex: "#6366f1",
      },
    },
    { upsert: true, new: true }
  );

  const env_ = await EnvironmentModel.findOneAndUpdate(
    { projectId: project.id, name: "prod" },
    {
      $setOnInsert: {
        name: "prod",
        projectId: project.id,
        urlBase: "https://demo-app.example.com",
      },
    },
    { upsert: true, new: true }
  );

  // Client
  const client = await ClientModel.findOneAndUpdate(
    { name: "Demo" },
    {
      $setOnInsert: {
        name: "Demo",
        type: "demo",
        notes: "Cliente seed Fase 1",
        colorHex: "#10b981",
      },
    },
    { upsert: true, new: true }
  );

  // Server
  let server = await ServerModel.findOne({ name: "demo-vm-01" });
  if (!server) {
    server = await ServerModel.create({
      name: "demo-vm-01",
      cloudSourceId,
      provider: "digitalocean",
      providerInstanceId: "droplet-mock-001",
      region: "nyc3",
      publicIp: "203.0.113.10",
      privateIp: "10.10.0.10",
      os: "ubuntu-22.04",
      status: "running",
      bootstrapStatus: "done",
      specs: { cpu: 1, ramMb: 1024, diskGb: 25, instanceType: "s-1vcpu-1gb" },
      tags: ["demo", "fase-1"],
      costEstimate: { hourlyUsd: 0.00893, monthlyUsd: 6, lastCalculatedAt: new Date() },
      ssh: { user: "root", port: 22 },
      provisionedAt: new Date(),
      lastSeenAt: new Date(),
    });
    logger.info({ id: server.id }, "🖥️  Server 'demo-vm-01' creado");
  }

  // 2 Containers
  const containerDefs = [
    {
      containerId: randomUUID().replace(/-/g, "").slice(0, 12),
      name: "demo-web",
      image: "nginx:1.27-alpine",
      ports: [{ host: 80, container: 80, proto: "tcp" as const }],
    },
    {
      containerId: randomUUID().replace(/-/g, "").slice(0, 12),
      name: "demo-db",
      image: "postgres:16-alpine",
      ports: [{ host: 5432, container: 5432, proto: "tcp" as const }],
    },
  ];

  for (const def of containerDefs) {
    await ContainerModel.findOneAndUpdate(
      { serverId: server.id, name: def.name },
      {
        $setOnInsert: {
          serverId: server.id,
          containerId: def.containerId,
          name: def.name,
          image: def.image,
          state: "running",
          ports: def.ports,
          labels: { managedBy: "init-db" },
          environmentId: env_.id,
          projectId: project.id,
          clientId: client.id,
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }
  logger.info("🐳 Containers seed listos");
}

async function seedPlaybooks() {
  const builtins = [
    {
      slug: "install-docker",
      name: "Instalar Docker",
      description: "Instala Docker CE en Ubuntu 22.04",
      kind: "shell" as const,
      requires: { os: "ubuntu" },
      steps: [
        {
          name: "Actualizar apt",
          command: "DEBIAN_FRONTEND=noninteractive apt-get update -y",
          timeoutSec: 120,
        },
        {
          name: "Instalar dependencias",
          command:
            "DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg",
          timeoutSec: 180,
        },
        {
          name: "Añadir GPG key Docker",
          command:
            "install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && chmod a+r /etc/apt/keyrings/docker.gpg",
          timeoutSec: 60,
        },
        {
          name: "Añadir repo Docker",
          command:
            'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list',
          timeoutSec: 30,
        },
        {
          name: "Instalar Docker Engine",
          command:
            "DEBIAN_FRONTEND=noninteractive apt-get update -y && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
          timeoutSec: 300,
        },
        {
          name: "Verificar instalación",
          command: "docker --version && docker compose version",
          timeoutSec: 10,
        },
      ],
    },
    {
      slug: "install-docker-traefik",
      name: "Docker + Traefik",
      description: "Docker CE + Traefik v3 como reverse proxy con redirect HTTPS",
      kind: "composite" as const,
      requires: { os: "ubuntu", minRamMb: 512 },
      steps: [
        {
          name: "Bootstrap Docker (delegado)",
          command: "echo 'Ejecutar install-docker primero como dependencia'",
          timeoutSec: 5,
        },
        {
          name: "Crear red traefik",
          command: "docker network create traefik || true",
          timeoutSec: 10,
        },
        {
          name: "Crear directorio /opt/traefik",
          command: "mkdir -p /opt/traefik && chmod 700 /opt/traefik",
          timeoutSec: 5,
        },
        {
          name: "Levantar Traefik",
          command:
            'cd /opt/traefik && cat > docker-compose.yml <<EOF\nservices:\n  traefik:\n    image: traefik:v3\n    restart: unless-stopped\n    networks: [traefik]\n    ports: ["80:80","443:443"]\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock:ro\n      - ./acme.json:/acme.json\n    command:\n      - --providers.docker\n      - --providers.docker.exposedbydefault=false\n      - --entrypoints.web.address=:80\n      - --entrypoints.websecure.address=:443\n      - --certificatesresolvers.le.acme.tlschallenge=true\n      - --certificatesresolvers.le.acme.email=admin@example.com\n      - --certificatesresolvers.le.acme.storage=/acme.json\nnetworks:\n  traefik:\n    external: true\nEOF\ntouch acme.json && chmod 600 acme.json && docker compose up -d',
          timeoutSec: 60,
        },
      ],
    },
  ];

  for (const def of builtins) {
    await PlaybookModel.findOneAndUpdate(
      { slug: def.slug },
      {
        $set: { ...def, isBuiltin: true, version: 1 },
      },
      { upsert: true, new: true }
    );
  }
  logger.info({ count: builtins.length }, "📜 Playbooks built-in seed listos");
}

async function main(): Promise<void> {
  await connectMongo();
  try {
    await seedOwner();
    const cloudSourceId = await seedCloudSource();
    await seedTopology(cloudSourceId);
    await seedPlaybooks();
    logger.info("✅ Seed completo");
  } finally {
    await disconnectMongo();
  }
}

main().catch((err) => {
  logger.error({ err }, "❌ init-db falló");
  process.exit(1);
});
