import type { LogLevel, LogSource, ProvisionPhase } from "./enums.js";

/**
 * Eventos de Socket.IO por namespace.
 * Mantener sincronizado con apps/api/src/sockets/*.
 */

// ----- /terminal -----
export interface TerminalOpenPayload {
  serverId: string;
  cols?: number;
  rows?: number;
}
export interface TerminalDataPayload {
  data: string;
}
export interface TerminalResizePayload {
  cols: number;
  rows: number;
}

// ----- /logs -----
export interface LogsSubscribePayload {
  serverId?: string;
  containerId?: string;
  mode: "tail";
}
export interface LogLinePayload {
  serverId: string;
  containerId?: string;
  source: LogSource;
  level: LogLevel;
  message: string;
  ts: string; // ISO
}

// ----- /provision -----
export interface ProvisionJoinPayload {
  taskId: string;
}
export interface ProvisionPhaseEvent {
  taskId: string;
  phase: ProvisionPhase;
  message?: string;
}
export interface ProvisionLogEvent {
  taskId: string;
  line: string;
  level: LogLevel;
  ts: string;
}
export interface ProvisionDoneEvent {
  taskId: string;
  serverId: string;
}
export interface ProvisionErrorEvent {
  taskId: string;
  error: string;
}
