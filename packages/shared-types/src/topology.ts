import type {
  Provider,
  ServerStatus,
  ContainerState,
  EnvName,
  ClientType,
} from "./enums.js";

/**
 * Nodo y arista en formato xyflow para las vistas de topología.
 * El backend genera el grafo a partir de Mongo; el frontend solo lo pinta.
 */

export type NodeKind =
  | "server"
  | "container"
  | "environment"
  | "project"
  | "client"
  | "database";

export interface TopologyNode {
  id: string; // único en el grafo (prefijo por tipo, ej. "server:<uuid>")
  kind: NodeKind;
  label: string;
  data: Record<string, unknown>;
  /** Posición opcional — si el backend no la calcula, el layout cliente la asigna. */
  position?: { x: number; y: number };
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind?: "contains" | "uses" | "deploys-to";
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  /** Etiqueta del agrupamiento usado ("infrastructure" | "clients"). */
  groupedBy: "infrastructure" | "clients";
  generatedAt: string; // ISO
}

// ---- Datos por tipo de nodo (lo que vive en `data`) ----

export interface ServerNodeData {
  provider: Provider;
  region: string;
  publicIp?: string;
  privateIp?: string;
  status: ServerStatus;
  os?: string;
  costMonthlyUsd?: number;
  containerCount: number;
}

export interface ContainerNodeData {
  image: string;
  state: ContainerState;
  ports?: { host?: number; container: number; proto?: "tcp" | "udp" }[];
}

export interface EnvironmentNodeData {
  name: EnvName;
  urlBase?: string;
}

export interface ProjectNodeData {
  slug: string;
  colorHex?: string;
}

export interface ClientNodeData {
  type: ClientType;
  colorHex?: string;
  serverCount: number;
}
