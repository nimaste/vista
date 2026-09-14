import "server-only";
import { prisma } from "./db";
import { decryptSecretOrNull, encryptSecretOrNull } from "./crypto";

export type ServiceType = "SONARR" | "RADARR" | "OVERSEERR" | "NZBGET" | "SABNZBD";

export type DecryptedConnection = {
  id: string;
  serviceType: ServiceType;
  name: string | null;
  baseUrl: string;
  apiKey: string | null;
  username: string | null;
  password: string | null;
  enabled: boolean;
};

/** Reads one service's connection, decrypted, or null if unconfigured/disabled. */
export const getConnection = async (serviceType: ServiceType): Promise<DecryptedConnection | null> => {
  const row = await prisma.serverConnection.findUnique({ where: { serviceType } });
  if (!row || !row.enabled) return null;
  return {
    id: row.id,
    serviceType: row.serviceType as ServiceType,
    name: row.name,
    baseUrl: row.baseUrl.replace(/\/+$/, ""),
    apiKey: decryptSecretOrNull(row.apiKey),
    username: row.username,
    password: decryptSecretOrNull(row.password),
    enabled: row.enabled,
  };
};

export type ConnectionInput = {
  name?: string | null;
  baseUrl: string;
  apiKey?: string | null;
  username?: string | null;
  password?: string | null;
  enabled?: boolean;
};

/** Creates or updates the one connection for a service type. Encrypts apiKey/password. */
export const upsertConnection = async (serviceType: ServiceType, input: ConnectionInput) => {
  const data = {
    name: input.name ?? null,
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    apiKey: encryptSecretOrNull(input.apiKey),
    username: input.username ?? null,
    password: encryptSecretOrNull(input.password),
    enabled: input.enabled ?? true,
  };
  return prisma.serverConnection.upsert({
    where: { serviceType },
    create: { serviceType, ...data },
    update: data,
  });
};

export const recordTestResult = async (serviceType: ServiceType, ok: boolean) =>
  prisma.serverConnection.updateMany({
    where: { serviceType },
    data: { lastTestedAt: new Date(), lastTestOk: ok },
  });

/** Lists all connections with secrets redacted (for the Settings UI). */
export const listConnectionsRedacted = async () => {
  const rows = await prisma.serverConnection.findMany({ orderBy: { serviceType: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    serviceType: r.serviceType,
    name: r.name,
    baseUrl: r.baseUrl,
    hasApiKey: !!r.apiKey,
    hasPassword: !!r.password,
    username: r.username,
    enabled: r.enabled,
    lastTestedAt: r.lastTestedAt,
    lastTestOk: r.lastTestOk,
  }));
};
