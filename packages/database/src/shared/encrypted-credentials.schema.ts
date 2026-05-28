import { Schema } from "mongoose";

/**
 * Sub-esquema para guardar credenciales cifradas con libsodium
 * (`crypto_secretbox`). El cifrado/descifrado real vive en
 * apps/api/src/utils/crypto.ts — este esquema solo aloja el ciphertext.
 *
 * `keyId` permite rotación: si la MASTER_KEY cambia, sabemos qué key usó
 * cada documento.
 */
export interface IEncryptedCredentials {
  ciphertext: string; // base64
  nonce: string; // base64
  keyId: string; // "v1" por defecto, sube al rotar
}

export const encryptedCredentialsSchema = new Schema<IEncryptedCredentials>(
  {
    ciphertext: { type: String, required: true },
    nonce: { type: String, required: true },
    keyId: { type: String, required: true, default: "v1" },
  },
  { _id: false }
);
