import {
  ServerModel,
  ContainerModel,
  EnvironmentModel,
  ProjectModel,
  ClientModel,
} from "@inframonitor/database";
import type {
  TopologyGraph,
  TopologyNode,
  TopologyEdge,
  ServerNodeData,
  ContainerNodeData,
  EnvironmentNodeData,
  ProjectNodeData,
  ClientNodeData,
} from "@inframonitor/shared-types";

/**
 * Vista A — Infraestructura.
 * Jerarquía: Server → Container → Environment → Project.
 * Layout simple en columnas (x) por nivel; el frontend lo refina.
 */
export async function buildInfrastructureGraph(): Promise<TopologyGraph> {
  const [servers, containers, environments, projects] = await Promise.all([
    ServerModel.find({ deletedAt: null }).lean(),
    ContainerModel.find({ deletedAt: null }).lean(),
    EnvironmentModel.find({ deletedAt: null }).lean(),
    ProjectModel.find({ deletedAt: null }).lean(),
  ]);

  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];

  // ---- Columna 0: Projects ----
  projects.forEach((p, i) => {
    const data: ProjectNodeData = { slug: p.slug, colorHex: p.colorHex };
    nodes.push({
      id: `project:${p.id}`,
      kind: "project",
      label: p.name,
      data: data as unknown as Record<string, unknown>,
      position: { x: 0, y: i * 160 },
    });
  });

  // ---- Columna 1: Environments ----
  environments.forEach((e, i) => {
    const data: EnvironmentNodeData = { name: e.name, urlBase: e.urlBase ?? undefined };
    nodes.push({
      id: `environment:${e.id}`,
      kind: "environment",
      label: e.name,
      data: data as unknown as Record<string, unknown>,
      position: { x: 280, y: i * 120 },
    });
    edges.push({
      id: `edge:project-env:${e.id}`,
      source: `project:${e.projectId}`,
      target: `environment:${e.id}`,
      kind: "contains",
    });
  });

  // Map containerId -> server label for fast lookups (no usado aquí pero útil)
  const containersByServer = new Map<string, typeof containers>();
  for (const c of containers) {
    if (!containersByServer.has(c.serverId)) containersByServer.set(c.serverId, []);
    containersByServer.get(c.serverId)!.push(c);
  }

  // ---- Columna 2: Servers ----
  servers.forEach((s, i) => {
    const data: ServerNodeData = {
      provider: s.provider,
      region: s.region,
      publicIp: s.publicIp ?? undefined,
      privateIp: s.privateIp ?? undefined,
      status: s.status,
      os: s.os ?? undefined,
      costMonthlyUsd: s.costEstimate?.monthlyUsd,
      containerCount: containersByServer.get(s.id)?.length ?? 0,
    };
    nodes.push({
      id: `server:${s.id}`,
      kind: "server",
      label: s.name,
      data: data as unknown as Record<string, unknown>,
      position: { x: 560, y: i * 200 },
    });
  });

  // ---- Columna 3: Containers ----
  containers.forEach((c, i) => {
    const data: ContainerNodeData = {
      image: c.image,
      state: c.state,
      ports: c.ports?.map((p) => ({
        host: p.host,
        container: p.container,
        proto: p.proto,
      })),
    };
    nodes.push({
      id: `container:${c.id}`,
      kind: "container",
      label: c.name,
      data: data as unknown as Record<string, unknown>,
      position: { x: 840, y: i * 100 },
    });
    edges.push({
      id: `edge:server-container:${c.id}`,
      source: `server:${c.serverId}`,
      target: `container:${c.id}`,
      kind: "contains",
    });
    if (c.environmentId) {
      edges.push({
        id: `edge:env-container:${c.id}`,
        source: `environment:${c.environmentId}`,
        target: `container:${c.id}`,
        kind: "deploys-to",
      });
    }
  });

  return {
    nodes,
    edges,
    groupedBy: "infrastructure",
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Vista B — Por cliente.
 * Para cada Client: enumera los Servers únicos que tienen al menos un
 * Container asignado a ese Client.
 */
export async function buildClientsGraph(): Promise<TopologyGraph> {
  const [clients, containers, servers] = await Promise.all([
    ClientModel.find({ deletedAt: null }).lean(),
    ContainerModel.find({ deletedAt: null, clientId: { $ne: null } }).lean(),
    ServerModel.find({ deletedAt: null }).lean(),
  ]);

  const serverById = new Map(servers.map((s) => [s.id, s]));
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];

  // Pre-cómputo: serverIds únicos por cliente
  const serverIdsByClient = new Map<string, Set<string>>();
  for (const c of containers) {
    if (!c.clientId) continue;
    if (!serverIdsByClient.has(c.clientId)) {
      serverIdsByClient.set(c.clientId, new Set());
    }
    serverIdsByClient.get(c.clientId)!.add(c.serverId);
  }

  clients.forEach((cl, ci) => {
    const serverIds = serverIdsByClient.get(cl.id) ?? new Set();
    const data: ClientNodeData = {
      type: cl.type,
      colorHex: cl.colorHex,
      serverCount: serverIds.size,
    };
    nodes.push({
      id: `client:${cl.id}`,
      kind: "client",
      label: cl.name,
      data: data as unknown as Record<string, unknown>,
      position: { x: 0, y: ci * 200 },
    });

    let yOffset = 0;
    for (const sid of serverIds) {
      const s = serverById.get(sid);
      if (!s) continue;
      // Re-usamos un nodo server por cliente (prefijo client:s para no chocar)
      const nodeId = `client:${cl.id}:server:${s.id}`;
      const data: ServerNodeData = {
        provider: s.provider,
        region: s.region,
        publicIp: s.publicIp ?? undefined,
        privateIp: s.privateIp ?? undefined,
        status: s.status,
        os: s.os ?? undefined,
        costMonthlyUsd: s.costEstimate?.monthlyUsd,
        containerCount: containers.filter(
          (c) => c.serverId === sid && c.clientId === cl.id
        ).length,
      };
      nodes.push({
        id: nodeId,
        kind: "server",
        label: s.name,
        data: data as unknown as Record<string, unknown>,
        position: { x: 320, y: ci * 200 + yOffset },
      });
      edges.push({
        id: `edge:client-server:${cl.id}:${s.id}`,
        source: `client:${cl.id}`,
        target: nodeId,
        kind: "uses",
      });
      yOffset += 120;
    }
  });

  return {
    nodes,
    edges,
    groupedBy: "clients",
    generatedAt: new Date().toISOString(),
  };
}
