// ----- Cloud providers soportados -----
export const PROVIDERS = ["aws", "digitalocean", "azure"] as const;
export type Provider = (typeof PROVIDERS)[number];

// ----- Ciclo de vida de un Server -----
export const SERVER_STATUSES = [
  "provisioning",
  "running",
  "stopped",
  "terminated",
  "error",
] as const;
export type ServerStatus = (typeof SERVER_STATUSES)[number];

// ----- Estado de bootstrap (post-provisioning playbook) -----
export const BOOTSTRAP_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "skipped",
] as const;
export type BootstrapStatus = (typeof BOOTSTRAP_STATUSES)[number];

// ----- Estados Docker container -----
export const CONTAINER_STATES = [
  "running",
  "exited",
  "restarting",
  "paused",
  "dead",
  "created",
] as const;
export type ContainerState = (typeof CONTAINER_STATES)[number];

// ----- Ambientes -----
export const ENV_NAMES = ["dev", "staging", "prod", "qa"] as const;
export type EnvName = (typeof ENV_NAMES)[number];

// ----- Tipos de Cliente (deploy final) -----
export const CLIENT_TYPES = [
  "municipality",
  "internal",
  "external",
  "demo",
] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

// ----- Tipos de Playbook -----
export const PLAYBOOK_KINDS = ["shell", "compose", "composite"] as const;
export type PlaybookKind = (typeof PLAYBOOK_KINDS)[number];

// ----- Estado de PlaybookRun / ProvisionTask -----
export const RUN_STATUSES = [
  "pending",
  "running",
  "success",
  "failed",
  "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

// ----- Fases del ProvisionTask -----
export const PROVISION_PHASES = [
  "creating-vm",
  "waiting-ssh",
  "running-playbook",
  "done",
  "error",
] as const;
export type ProvisionPhase = (typeof PROVISION_PHASES)[number];

// ----- Nivel de log -----
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

// ----- Origen de log -----
export const LOG_SOURCES = ["docker", "syslog", "playbook", "ssh"] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

// ----- Roles de usuario (MVP single-tenant: solo owner) -----
export const USER_ROLES = ["owner"] as const;
export type UserRole = (typeof USER_ROLES)[number];
