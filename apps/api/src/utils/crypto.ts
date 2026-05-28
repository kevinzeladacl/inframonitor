/**
 * Cifrado simétrico de credenciales con libsodium-wrappers (crypto_secretbox).
 *
 * - Algoritmo: XSalsa20 + Poly1305 (autenticado).
 * - `MASTER_KEY` en .env: 32 bytes (256 bits) base64.
 * - Cada ciphertext lleva su propio nonce (24 bytes random).
 * - `keyId` permite rotación: si MASTER_KEY cambia, los docs viejos siguen
 *   descifrables con la key anterior si se mantiene un keychain (post-MVP).
 *
 * En Fase 3 sólo soportamos keyId="v1" (la MASTER_KEY actual del .env).
 */
import sodium from "libsodium-wrappers";
import { env } from "../config/env.js";

let ready = false;
async function ensureReady(): Promise<void> {
  if (!ready) {
    await sodium.ready;
    ready = true;
  }
}

function getKey(): Uint8Array {
  if (!env.MASTER_KEY) {
    throw new Error(
      "MASTER_KEY no configurada en .env. Generar con: openssl rand -base64 32"
    );
  }
  const raw = sodium.from_base64(env.MASTER_KEY, sodium.base64_variants.ORIGINAL);
  if (raw.length !== sodium.crypto_secretbox_KEYBYTES) {
    throw new Error(
      `MASTER_KEY debe ser ${sodium.crypto_secretbox_KEYBYTES} bytes (recibido ${raw.length})`
    );
  }
  return raw;
}

export interface EncryptedBlob {
  ciphertext: string; // base64
  nonce: string; // base64
  keyId: string;
}

/** Cifra un string (típicamente un JSON.stringify de credenciales). */
export async function encryptSecret(plaintext: string): Promise<EncryptedBlob> {
  await ensureReady();
  const key = getKey();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const cipher = sodium.crypto_secretbox_easy(plaintext, nonce, key);
  return {
    ciphertext: sodium.to_base64(cipher, sodium.base64_variants.ORIGINAL),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
    keyId: "v1",
  };
}

/** Descifra y devuelve el string original. Lanza si el ciphertext está corrupto. */
export async function decryptSecret(blob: EncryptedBlob): Promise<string> {
  await ensureReady();
  if (blob.keyId !== "v1") {
    throw new Error(`keyId '${blob.keyId}' no soportado (rotación pendiente)`);
  }
  const key = getKey();
  const cipher = sodium.from_base64(blob.ciphertext, sodium.base64_variants.ORIGINAL);
  const nonce = sodium.from_base64(blob.nonce, sodium.base64_variants.ORIGINAL);
  const plain = sodium.crypto_secretbox_open_easy(cipher, nonce, key);
  return sodium.to_string(plain);
}

/** Cifra un objeto. Conveniencia. */
export async function encryptJson<T>(value: T): Promise<EncryptedBlob> {
  return encryptSecret(JSON.stringify(value));
}

/** Descifra un objeto JSON. */
export async function decryptJson<T>(blob: EncryptedBlob): Promise<T> {
  const plain = await decryptSecret(blob);
  return JSON.parse(plain) as T;
}
