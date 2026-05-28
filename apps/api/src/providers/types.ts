import type { Provider } from "@inframonitor/shared-types";

/**
 * Credenciales por proveedor — el shape que se cifra en CloudSource.credentials.
 * Cada provider valida y consume sus propios campos.
 */
export interface AwsCredentials {
  provider: "aws";
  accessKeyId: string;
  secretAccessKey: string;
  defaultRegion: string;
}

export interface DigitalOceanCredentials {
  provider: "digitalocean";
  token: string;
}

export interface AzureCredentials {
  provider: "azure";
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

export type ProviderCredentials = AwsCredentials | DigitalOceanCredentials | AzureCredentials;

/**
 * Instancia normalizada que devuelven los providers al importar/listar.
 * Es lo mínimo común; los detalles ricos quedan en `raw` para inspección.
 */
export interface NormalizedInstance {
  providerInstanceId: string;
  name: string;
  region: string;
  availabilityZone?: string;
  publicIp?: string;
  privateIp?: string;
  os?: string;
  status: "running" | "stopped" | "provisioning" | "terminated" | "error";
  specs: {
    cpu?: number;
    ramMb?: number;
    diskGb?: number;
    instanceType?: string;
  };
  costEstimate?: {
    hourlyUsd?: number;
    monthlyUsd?: number;
  };
  tags?: string[];
  raw?: unknown;
}

export interface ProvisionRequest {
  name: string;
  region: string;
  size: string; // instanceType / dropletSize / vmSize según provider
  os: string; // image slug/AMI
  sshPublicKey: string;
  /** Etiquetas/Tags por provider */
  tags?: string[];
}

export interface ProvisionResult {
  providerInstanceId: string;
  publicIp?: string;
  privateIp?: string;
  status: NormalizedInstance["status"];
}

/**
 * Interfaz común para los 3 providers. Cada uno implementa lo que su API
 * soporta — los métodos opcionales pueden lanzar "not implemented".
 */
export interface CloudProviderAdapter {
  provider: Provider;
  /** Test de credenciales — debe ser barato. */
  verify(): Promise<{ ok: boolean; identity?: string; error?: string }>;
  /** Lista instancias existentes en la cuenta. */
  listInstances(): Promise<NormalizedInstance[]>;
  /** Catálogo de regiones para el wizard. */
  listRegions(): Promise<{ slug: string; name: string }[]>;
  /** Catálogo de tamaños/instancias. */
  listSizes(region?: string): Promise<{ slug: string; name: string; cpu?: number; ramMb?: number; diskGb?: number; hourlyUsd?: number }[]>;
  /** Crea una VM. Devuelve apenas el id + ip cuando esté disponible. */
  createInstance(req: ProvisionRequest): Promise<ProvisionResult>;
  /** Termina (destroy/delete) una VM. */
  terminateInstance(providerInstanceId: string, region?: string): Promise<void>;
  /** Encender / detener una VM. */
  startInstance?(providerInstanceId: string, region?: string): Promise<void>;
  stopInstance?(providerInstanceId: string, region?: string): Promise<void>;
}
