import type { CloudProviderAdapter, ProviderCredentials } from "./types.js";
import { AwsAdapter } from "./aws.js";
import { DigitalOceanAdapter } from "./digitalocean.js";
import { AzureAdapter } from "./azure.js";

/**
 * Fábrica que devuelve el adapter correcto según las credenciales descifradas.
 * Llamar desde apps/api/src/services/cloud-source.service.ts.
 */
export function getProviderAdapter(creds: ProviderCredentials): CloudProviderAdapter {
  switch (creds.provider) {
    case "aws":
      return new AwsAdapter(creds);
    case "digitalocean":
      return new DigitalOceanAdapter(creds);
    case "azure":
      return new AzureAdapter(creds);
    default:
      throw new Error(`Provider no soportado: ${(creds as { provider: string }).provider}`);
  }
}

export * from "./types.js";
