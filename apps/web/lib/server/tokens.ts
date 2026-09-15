import "server-only";
import crypto from "node:crypto";

export const TOKEN_PREFIX = "vista_";

export const generateRawToken = (): string => {
  const random = crypto.randomBytes(24).toString("base64url");
  return `${TOKEN_PREFIX}${random}`;
};

export const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw).digest("hex");

export const displayPrefix = (raw: string): string => raw.slice(0, TOKEN_PREFIX.length + 6);
