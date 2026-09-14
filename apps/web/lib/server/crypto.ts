import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env";

// AES-256-GCM, key derived from JWT_SECRET (already required, >=32 chars) rather
// than introducing a second required secret. Used to encrypt ServerConnection's
// apiKey/password columns at rest -- these are real live credentials for every
// connected service, not just a session-signing key.

const getKey = (): Buffer => createHash("sha256").update(env.JWT_SECRET).digest();

const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

/** Returns `<iv>:<authTag>:<ciphertext>`, each base64. */
export const encryptSecret = (plaintext: string): string => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
};

export const decryptSecret = (encoded: string): string => {
  const [ivB64, tagB64, dataB64] = encoded.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted value");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Malformed encrypted value: bad auth tag length");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
};

/** Encrypts only when the value is non-empty; passes through null/undefined. */
export const encryptSecretOrNull = (plaintext: string | null | undefined): string | null =>
  plaintext ? encryptSecret(plaintext) : null;

export const decryptSecretOrNull = (encoded: string | null | undefined): string | null =>
  encoded ? decryptSecret(encoded) : null;
