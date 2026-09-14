import "server-only";
import { prisma } from "./db";
import { encryptSecretOrNull } from "./crypto";
import type { ServiceType } from "./connections";

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log("[migrate-connections]", ...args);
};

/**
 * One-time, idempotent migration off the old single-instance
 * Setting{key:"sonarr"|"radarr"} JSON blobs onto the new relational
 * ServerConnection table. Runs at every startup (see instrumentation.ts) but
 * only does anything the first time -- skips a service type if a
 * ServerConnection row for it already exists, and renames (never deletes)
 * the old Setting row so the migration is trivially reversible.
 *
 * The old Plex Watchlist Setting row gets the same rename-not-delete
 * treatment even though that feature itself has been removed -- nothing
 * reads plex-watchlist_migrated_v1, it's just preserved history.
 */
export const migrateServerConnections = async (): Promise<void> => {
  const legacyKeys: { settingKey: string; serviceType: ServiceType }[] = [
    { settingKey: "sonarr", serviceType: "SONARR" },
    { settingKey: "radarr", serviceType: "RADARR" },
  ];

  for (const { settingKey, serviceType } of legacyKeys) {
    const already = await prisma.serverConnection.findUnique({ where: { serviceType } });
    if (already) continue;

    const row = await prisma.setting.findUnique({ where: { key: settingKey } });
    if (!row) continue;

    // Deliberately NOT carrying forward the old defaultQualityProfileId/
    // defaultRootFolderPath -- those were Vista opining on Sonarr/Radarr's
    // own configuration, which doesn't belong in a portal. The add flow
    // just asks Sonarr/Radarr for their own profile/folder list directly.
    let parsed: { url?: string; apiKey?: string };
    try {
      parsed = JSON.parse(row.value);
    } catch {
      log(`skipping malformed legacy setting "${settingKey}"`);
      continue;
    }
    if (!parsed.url || !parsed.apiKey) continue;

    await prisma.serverConnection.create({
      data: {
        serviceType,
        baseUrl: parsed.url.replace(/\/+$/, ""),
        apiKey: encryptSecretOrNull(parsed.apiKey),
        enabled: true,
      },
    });

    await prisma.setting.update({
      where: { key: settingKey },
      data: { key: `${settingKey}_migrated_v1` },
    });

    log(`migrated legacy "${settingKey}" setting -> ServerConnection(${serviceType})`);
  }

  // Preserve (don't delete) the Plex Watchlist config row -- the feature is
  // removed, but the old setting is kept as inert history, same as above.
  const watchlist = await prisma.setting.findUnique({ where: { key: "plex-watchlist" } });
  if (watchlist) {
    await prisma.setting.update({
      where: { key: "plex-watchlist" },
      data: { key: "plex-watchlist_migrated_v1" },
    });
    log("archived removed plex-watchlist setting");
  }
};
