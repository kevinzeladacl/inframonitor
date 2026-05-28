import axios, { type AxiosInstance } from "axios";
import type {
  CloudProviderAdapter,
  DigitalOceanCredentials,
  NormalizedInstance,
  ProvisionRequest,
  ProvisionResult,
} from "./types.js";

const BASE_URL = "https://api.digitalocean.com/v2";

/**
 * Adapter DigitalOcean usando la API REST v2 directamente (sin dots-wrapper).
 */
export class DigitalOceanAdapter implements CloudProviderAdapter {
  readonly provider = "digitalocean" as const;
  private http: AxiosInstance;

  constructor(creds: DigitalOceanCredentials) {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 15_000,
      headers: { Authorization: `Bearer ${creds.token}` },
      validateStatus: () => true,
    });
  }

  async verify() {
    const res = await this.http.get("/account");
    if (res.status === 200) {
      const acc = res.data?.account;
      return { ok: true, identity: acc?.email ?? "DO account" };
    }
    return {
      ok: false,
      error: res.data?.message ?? `HTTP ${res.status}`,
    };
  }

  async listInstances(): Promise<NormalizedInstance[]> {
    const res = await this.http.get("/droplets", { params: { per_page: 200 } });
    if (res.status !== 200) throw new Error(res.data?.message ?? `HTTP ${res.status}`);
    const droplets = (res.data?.droplets ?? []) as Array<any>;
    return droplets.map((d) => ({
      providerInstanceId: String(d.id),
      name: d.name,
      region: d.region?.slug ?? "unknown",
      publicIp: d.networks?.v4?.find((n: any) => n.type === "public")?.ip_address,
      privateIp: d.networks?.v4?.find((n: any) => n.type === "private")?.ip_address,
      os: d.image?.slug ?? d.image?.distribution,
      status:
        d.status === "active"
          ? "running"
          : d.status === "off"
          ? "stopped"
          : d.status === "new"
          ? "provisioning"
          : d.status === "archive"
          ? "terminated"
          : "error",
      specs: {
        cpu: d.vcpus,
        ramMb: d.memory,
        diskGb: d.disk,
        instanceType: d.size_slug,
      },
      costEstimate: {
        hourlyUsd: d.size?.price_hourly,
        monthlyUsd: d.size?.price_monthly,
      },
      tags: d.tags ?? [],
      raw: d,
    }));
  }

  async listRegions() {
    const res = await this.http.get("/regions");
    if (res.status !== 200) return [];
    const regions = (res.data?.regions ?? []) as Array<any>;
    return regions
      .filter((r) => r.available)
      .map((r) => ({ slug: r.slug, name: r.name }));
  }

  async listSizes() {
    const res = await this.http.get("/sizes", { params: { per_page: 200 } });
    if (res.status !== 200) return [];
    const sizes = (res.data?.sizes ?? []) as Array<any>;
    return sizes
      .filter((s) => s.available)
      .map((s) => ({
        slug: s.slug,
        name: `${s.slug} (${s.vcpus}vCPU/${s.memory}MB)`,
        cpu: s.vcpus,
        ramMb: s.memory,
        diskGb: s.disk,
        hourlyUsd: s.price_hourly,
      }));
  }

  async createInstance(req: ProvisionRequest): Promise<ProvisionResult> {
    // Registrar la llave SSH y obtener su id (idempotente por fingerprint)
    let sshKeyId: number | undefined;
    const keyPost = await this.http.post("/account/keys", {
      name: `inframonitor-${Date.now()}`,
      public_key: req.sshPublicKey,
    });
    if (keyPost.status === 201) {
      sshKeyId = keyPost.data?.ssh_key?.id;
    } else if (keyPost.status === 422) {
      // ya existe — buscarlo por fingerprint
      const list = await this.http.get("/account/keys");
      const keys = (list.data?.ssh_keys ?? []) as Array<any>;
      sshKeyId = keys.find((k) => k.public_key.startsWith(req.sshPublicKey.slice(0, 80)))?.id;
    } else {
      throw new Error(keyPost.data?.message ?? `HTTP ${keyPost.status} en /account/keys`);
    }

    const create = await this.http.post("/droplets", {
      name: req.name,
      region: req.region,
      size: req.size,
      image: req.os,
      ssh_keys: sshKeyId ? [sshKeyId] : [],
      tags: req.tags ?? ["inframonitor"],
    });
    if (create.status !== 202) {
      throw new Error(create.data?.message ?? `HTTP ${create.status} al crear droplet`);
    }
    const d = create.data?.droplet;
    return {
      providerInstanceId: String(d.id),
      status: "provisioning",
    };
  }

  async terminateInstance(providerInstanceId: string) {
    const res = await this.http.delete(`/droplets/${providerInstanceId}`);
    if (res.status !== 204) {
      throw new Error(res.data?.message ?? `HTTP ${res.status} al destruir droplet`);
    }
  }

  async startInstance(providerInstanceId: string) {
    const res = await this.http.post(`/droplets/${providerInstanceId}/actions`, { type: "power_on" });
    if (res.status !== 201) throw new Error(`HTTP ${res.status}`);
  }
  async stopInstance(providerInstanceId: string) {
    const res = await this.http.post(`/droplets/${providerInstanceId}/actions`, { type: "shutdown" });
    if (res.status !== 201) throw new Error(`HTTP ${res.status}`);
  }
}
