import "server-only";
import { nzbget } from "./nzbget";
import { sabnzbd } from "./sabnzbd";

// Merges NZBGet + SABnzbd into one unified queue/history, source-tagged.
// Supports zero-to-one of each independently -- most households run only
// one, but nothing here assumes that.

export type DownloadItem = {
  id: string;
  source: "nzbget" | "sabnzbd";
  name: string;
  status: string;
  sizeMb: number;
  remainingMb?: number;
  progressPercent?: number;
  timestamp?: number;
};

export const downloads = {
  getQueue: async (): Promise<DownloadItem[]> => {
    const [nzbgetItems, sabnzbdItems] = await Promise.all([
      nzbget.isConfigured().then((ok) => (ok ? nzbget.listQueue() : [])),
      sabnzbd.isConfigured().then((ok) => (ok ? sabnzbd.listQueue() : [])),
    ]);

    const fromNzbget: DownloadItem[] = nzbgetItems.map((i) => ({
      id: String(i.NZBID),
      source: "nzbget",
      name: i.NZBName,
      status: i.Status,
      sizeMb: i.FileSizeMB,
      remainingMb: i.RemainingSizeMB,
      progressPercent: i.FileSizeMB > 0 ? Math.round((i.DownloadedSizeMB / i.FileSizeMB) * 100) : 0,
    }));

    const fromSabnzbd: DownloadItem[] = sabnzbdItems.map((s) => ({
      id: s.nzo_id,
      source: "sabnzbd",
      name: s.filename,
      status: s.status,
      sizeMb: Number(s.mb),
      remainingMb: Number(s.mbleft),
      progressPercent: Number(s.percentage),
    }));

    return [...fromNzbget, ...fromSabnzbd];
  },

  getHistory: async (): Promise<DownloadItem[]> => {
    const [nzbgetItems, sabnzbdItems] = await Promise.all([
      nzbget.isConfigured().then((ok) => (ok ? nzbget.listHistory() : [])),
      sabnzbd.isConfigured().then((ok) => (ok ? sabnzbd.listHistory() : [])),
    ]);

    const fromNzbget: DownloadItem[] = nzbgetItems.map((i) => ({
      id: String(i.NZBID),
      source: "nzbget",
      name: i.Name,
      status: i.Status,
      sizeMb: i.FileSizeMB,
      timestamp: i.HistoryTime,
    }));

    const fromSabnzbd: DownloadItem[] = sabnzbdItems.map((s) => ({
      id: s.nzo_id,
      source: "sabnzbd",
      name: s.name,
      status: s.status,
      sizeMb: Math.round(s.bytes / 1024 / 1024),
      timestamp: s.completed,
    }));

    return [...fromNzbget, ...fromSabnzbd].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  },

  deleteQueueItem: async (source: "nzbget" | "sabnzbd", id: string): Promise<void> => {
    if (source === "nzbget") await nzbget.deleteFromQueue(Number(id));
    else await sabnzbd.deleteFromQueue(id);
  },

  deleteHistoryItem: async (source: "nzbget" | "sabnzbd", id: string): Promise<void> => {
    if (source === "nzbget") await nzbget.deleteFromHistory(Number(id));
    else await sabnzbd.deleteFromHistory(id);
  },
};
