/**
 * @inframonitor/database
 * Modelos Mongoose compartidos. Importar siempre desde aquí, no profundizar.
 */

// ----- Helpers compartidos -----
export {
  baseSchemaOptions,
  uuidIdField,
  softDeleteField,
  applyBaseSchema,
  colorHexField,
} from "./shared/base.js";
export {
  encryptedCredentialsSchema,
  type IEncryptedCredentials,
} from "./shared/encrypted-credentials.schema.js";

// ----- Entidades -----
export * from "./entities/user/index.js";
export * from "./entities/cloud-source/index.js";
export * from "./entities/ssh-key/index.js";
export * from "./entities/server/index.js";
export * from "./entities/container/index.js";
export * from "./entities/environment/index.js";
export * from "./entities/project/index.js";
export * from "./entities/client/index.js";
export * from "./entities/playbook/index.js";
export * from "./entities/playbook-run/index.js";
export * from "./entities/provision-task/index.js";
export * from "./entities/log-entry/index.js";
export * from "./entities/audit-log/index.js";
