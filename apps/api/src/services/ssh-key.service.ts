import { generateKeyPairSync, createHash } from "node:crypto";
import { SshKeyModel, type ISshKey } from "@inframonitor/database";
import { encryptSecret, decryptSecret } from "../utils/crypto.js";

/**
 * Genera un par de llaves ED25519 (más simple y rápido que RSA, y soportado
 * universalmente en OpenSSH ≥ 6.5).
 *
 * Persiste la pública en claro y la privada cifrada con libsodium.
 * Devuelve el documento listo para responder por API (sin la privada).
 */
export async function generateSshKey(name: string): Promise<ISshKey> {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // Convertir public PEM a OpenSSH format usable por authorized_keys.
  // Para ed25519, OpenSSH format = "ssh-ed25519 BASE64(blob) comment".
  const opensshPub = pemToOpenSshEd25519(publicKey as string, name);
  const fingerprint = sha256Fp(opensshPub);

  const encryptedPriv = await encryptSecret(privateKey as string);

  const doc = await SshKeyModel.create({
    name,
    publicKey: opensshPub,
    privateKeyEncrypted: encryptedPriv,
    fingerprint,
  });
  return doc;
}

export async function getSshKey(id: string): Promise<ISshKey | null> {
  return SshKeyModel.findOne({ id, deletedAt: null });
}

/** Devuelve la llave privada DESCIFRADA (PEM PKCS8). Usar sólo en SSH connect. */
export async function getDecryptedPrivateKey(id: string): Promise<string> {
  const key = await SshKeyModel.findOne({ id, deletedAt: null });
  if (!key) throw new Error(`SshKey ${id} no existe`);
  return decryptSecret(key.privateKeyEncrypted as any);
}

// ---- helpers de conversión PEM → OpenSSH ED25519 ----

function pemToOpenSshEd25519(pem: string, comment: string): string {
  // El DER de un public key ed25519 SPKI tiene 32 bytes de clave al final.
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Buffer.from(b64, "base64");
  const keyBytes = der.slice(der.length - 32);

  // SSH wire format: string "ssh-ed25519", string <32 raw bytes>
  const algName = Buffer.from("ssh-ed25519");
  const algLenBuf = Buffer.alloc(4);
  algLenBuf.writeUInt32BE(algName.length, 0);
  const keyLenBuf = Buffer.alloc(4);
  keyLenBuf.writeUInt32BE(keyBytes.length, 0);

  const wire = Buffer.concat([algLenBuf, algName, keyLenBuf, keyBytes]);
  return `ssh-ed25519 ${wire.toString("base64")} ${comment}`;
}

function sha256Fp(opensshPub: string): string {
  const parts = opensshPub.trim().split(/\s+/);
  if (parts.length < 2) return "";
  const blob = Buffer.from(parts[1], "base64");
  const hash = createHash("sha256").update(blob).digest("base64").replace(/=+$/, "");
  return `SHA256:${hash}`;
}
