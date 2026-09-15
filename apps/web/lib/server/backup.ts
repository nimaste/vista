import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { prisma } from "./db";

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log("[backup]", ...args);
};

/** Derive the DB file path from DATABASE_URL (strip `file:` prefix). */
const getDbPath = (): string => {
  const raw = env.DATABASE_URL;
  return raw.startsWith("file:") ? raw.slice(5) : raw;
};

/** Backup directory lives alongside the database file. */
export const getBackupDir = (): string => {
  const dbPath = getDbPath();
  return path.join(path.dirname(dbPath), "backups");
};

/** Ensure the backup directory exists. */
const ensureBackupDir = async (): Promise<string> => {
  const dir = getBackupDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

export type BackupInfo = {
  filename: string;
  size: number;
  createdAt: string;
};

/** Flush the WAL, then copy the database file to the backup directory. */
export const performBackup = async (): Promise<BackupInfo> => {
  const dbPath = getDbPath();
  const dir = await ensureBackupDir();

  // Flush WAL to the main database file before copying.
  await prisma.$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `vista-${stamp}.db`;
  const dest = path.join(dir, filename);

  await fs.copyFile(dbPath, dest);

  const stat = await fs.stat(dest);
  log(`created ${filename} (${stat.size} bytes)`);

  return { filename, size: stat.size, createdAt: now.toISOString() };
};

/** List all .db files in the backup directory, newest first. */
export const listBackups = async (): Promise<BackupInfo[]> => {
  const dir = await ensureBackupDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const backups: BackupInfo[] = [];
  for (const name of entries) {
    if (!name.endsWith(".db")) continue;
    try {
      const stat = await fs.stat(path.join(dir, name));
      backups.push({
        filename: name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      });
    } catch {
      // skip unreadable files
    }
  }

  backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return backups;
};

/** Delete the oldest backups beyond `keep` count. */
export const pruneBackups = async (keep: number): Promise<number> => {
  const backups = await listBackups();
  if (backups.length <= keep) return 0;

  const toDelete = backups.slice(keep);
  const dir = getBackupDir();
  let deleted = 0;

  for (const b of toDelete) {
    try {
      await fs.unlink(path.join(dir, b.filename));
      deleted++;
    } catch (err) {
      log("prune error", b.filename, err);
    }
  }

  log(`pruned ${deleted} old backup(s)`);
  return deleted;
};

/** Delete a specific backup by filename. */
export const deleteBackup = async (filename: string): Promise<void> => {
  // Sanitize: only allow simple filenames, no path traversal.
  if (filename.includes("/") || filename.includes("..")) {
    throw new Error("Invalid filename");
  }
  const dir = getBackupDir();
  await fs.unlink(path.join(dir, filename));
};

/** Get the full path to a backup file (validates it exists). */
export const getBackupPath = async (filename: string): Promise<string> => {
  if (filename.includes("/") || filename.includes("..")) {
    throw new Error("Invalid filename");
  }
  const full = path.join(getBackupDir(), filename);
  await fs.access(full); // throws if missing
  return full;
};

/**
 * Restore a backup: copy the given file over the live database, then
 * reconnect Prisma. This is destructive and requires admin auth.
 */
export const restoreFromBackup = async (sourcePath: string): Promise<void> => {
  const dbPath = getDbPath();

  // Disconnect Prisma so the DB file isn't locked.
  await prisma.$disconnect();

  try {
    await fs.copyFile(sourcePath, dbPath);
    // Also remove WAL/SHM files so SQLite starts clean.
    await fs.unlink(`${dbPath}-wal`).catch(() => {});
    await fs.unlink(`${dbPath}-shm`).catch(() => {});
    log("restored from", path.basename(sourcePath));
  } finally {
    // Reconnect regardless of success/failure.
    await prisma.$connect();
  }
};
