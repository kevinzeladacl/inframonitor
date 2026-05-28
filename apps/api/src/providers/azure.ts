import { ClientSecretCredential } from "@azure/identity";
import { ComputeManagementClient } from "@azure/arm-compute";
import { NetworkManagementClient } from "@azure/arm-network";
import { ResourceManagementClient } from "@azure/arm-resources";
import type {
  AzureCredentials,
  CloudProviderAdapter,
  NormalizedInstance,
  ProvisionRequest,
  ProvisionResult,
} from "./types.js";

/**
 * Adapter Azure. Provisioning real requiere 4 recursos (RG + VNet + NIC + VM).
 * Para MVP nos quedamos con `verify` + `listInstances` reales, y `createInstance`
 * encapsulado pero opinionado (usa un RG dedicado `inframonitor-<region>`).
 */
export class AzureAdapter implements CloudProviderAdapter {
  readonly provider = "azure" as const;
  private credential: ClientSecretCredential;

  constructor(private creds: AzureCredentials) {
    this.credential = new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);
  }

  private compute() {
    return new ComputeManagementClient(this.credential, this.creds.subscriptionId);
  }
  private network() {
    return new NetworkManagementClient(this.credential, this.creds.subscriptionId);
  }
  private resources() {
    return new ResourceManagementClient(this.credential, this.creds.subscriptionId);
  }

  async verify() {
    try {
      const rg = this.resources();
      const it = rg.subscriptions.list();
      // El cliente arm-resources expone subscriptions desde una propiedad,
      // pero como alternativa probamos un listResourceGroups que requiere lectura básica.
      const list = await rg.resourceGroups.list();
      let count = 0;
      for await (const _r of list) {
        count++;
        if (count > 2) break;
      }
      void it;
      return { ok: true, identity: `subscription ${this.creds.subscriptionId}` };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }

  async listInstances(): Promise<NormalizedInstance[]> {
    const compute = this.compute();
    const network = this.network();
    const results: NormalizedInstance[] = [];
    for await (const vm of compute.virtualMachines.listAll()) {
      if (!vm.id || !vm.name) continue;
      // Public IP requiere navegar NIC → PublicIPAddress (costoso). Lo intentamos best-effort.
      let publicIp: string | undefined;
      let privateIp: string | undefined;
      try {
        const nicRef = vm.networkProfile?.networkInterfaces?.[0]?.id;
        if (nicRef) {
          const m = nicRef.match(
            /resourceGroups\/([^/]+)\/providers\/Microsoft\.Network\/networkInterfaces\/([^/]+)/
          );
          if (m) {
            const nic = await network.networkInterfaces.get(m[1], m[2]);
            const ipConfig = nic.ipConfigurations?.[0];
            privateIp = ipConfig?.privateIPAddress;
            const pipRef = ipConfig?.publicIPAddress?.id;
            if (pipRef) {
              const pm = pipRef.match(
                /resourceGroups\/([^/]+)\/providers\/Microsoft\.Network\/publicIPAddresses\/([^/]+)/
              );
              if (pm) {
                const pip = await network.publicIPAddresses.get(pm[1], pm[2]);
                publicIp = pip.ipAddress;
              }
            }
          }
        }
      } catch {
        // best effort
      }
      results.push({
        providerInstanceId: vm.id,
        name: vm.name,
        region: vm.location ?? "unknown",
        publicIp,
        privateIp,
        os: vm.storageProfile?.imageReference?.offer,
        status:
          vm.provisioningState === "Succeeded"
            ? "running"
            : vm.provisioningState === "Failed"
            ? "error"
            : "provisioning",
        specs: { instanceType: vm.hardwareProfile?.vmSize ?? undefined },
        tags: vm.tags ? Object.entries(vm.tags).map(([k, v]) => `${k}=${v}`) : [],
      });
    }
    return results;
  }

  async listRegions() {
    // Catálogo común. Lista completa requiere subscriptions.listLocations.
    return [
      { slug: "eastus", name: "East US" },
      { slug: "westus2", name: "West US 2" },
      { slug: "westeurope", name: "West Europe" },
      { slug: "brazilsouth", name: "Brazil South" },
      { slug: "southcentralus", name: "South Central US" },
    ];
  }

  async listSizes() {
    return [
      { slug: "Standard_B1s", name: "Standard_B1s (1vCPU/1GB)", cpu: 1, ramMb: 1024 },
      { slug: "Standard_B1ms", name: "Standard_B1ms (1vCPU/2GB)", cpu: 1, ramMb: 2048 },
      { slug: "Standard_B2s", name: "Standard_B2s (2vCPU/4GB)", cpu: 2, ramMb: 4096 },
      { slug: "Standard_B2ms", name: "Standard_B2ms (2vCPU/8GB)", cpu: 2, ramMb: 8192 },
    ];
  }

  async createInstance(req: ProvisionRequest): Promise<ProvisionResult> {
    // Azure provisioning multi-recurso. Encapsulado para MVP: throw guiado.
    throw new Error(
      "Provisioning Azure requiere setup multi-recurso (RG+VNet+NIC+VM). " +
        "Por ahora usa el wizard con AWS o DigitalOcean. Implementación Azure completa: post-MVP."
    );
  }

  async terminateInstance(id: string) {
    // El id es el resource id completo; parse RG + name
    const m = id.match(/resourceGroups\/([^/]+)\/providers\/Microsoft\.Compute\/virtualMachines\/([^/]+)/);
    if (!m) throw new Error(`Resource ID Azure inválido: ${id}`);
    const compute = this.compute();
    await compute.virtualMachines.beginDeleteAndWait(m[1], m[2]);
  }
}
