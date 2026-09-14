import "server-only";
import { getConnection } from "./connections";

type SabnzbdConfig = { url: string; apiKey: string };

const getConfig = async (): Promise<SabnzbdConfig | null> => {
  const conn = await getConnection("SABNZBD");
  if (!conn || !conn.apiKey) return null;
  return { url: conn.baseUrl, apiKey: conn.apiKey };
};

class SabnzbdError extends Error {
  override name = "SabnzbdError";
  constructor(public status: number, message: string) {
    super(message);
  }
}

// SABnzbd's own convention is the API key as a query param (not a header),
// unlike every other service client here -- kept as-is rather than forced
// into a different shape, since there's no credential-leak concern the way
// there was for NZBGet's URL-embedded-creds convention.
const sabnzbdCall = async <T>(mode: string, extraParams: Record<string, string> = {}): Promise<T> => {
  const cfg = await getConfig();
  if (!cfg) throw new SabnzbdError(503, "SABnzbd not configured");
  const params = new URLSearchParams({ mode, apikey: cfg.apiKey, output: "json", ...extraParams });
  const res = await fetch(`${cfg.url}/api?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SabnzbdError(res.status, `SABnzbd ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
};

// -- Types --

export type SabnzbdQueueSlot = {
  nzo_id: string;
  filename: string;
  mb: string;
  mbleft: string;
  status: string; // Downloading | Paused | Queued | ...
  percentage: string;
};

export type SabnzbdHistorySlot = {
  nzo_id: string;
  name: string;
  status: string; // Completed | Failed
  bytes: number;
  completed: number; // unix seconds
};

// -- Exported API --

export const sabnzbd = {
  isConfigured: async (): Promise<boolean> => (await getConfig()) !== null,

  testConnection: async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const data = await sabnzbdCall<{ version: string }>("version");
      return { ok: true, message: `SABnzbd v${data.version}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  listQueue: async () => {
    const data = await sabnzbdCall<{ queue: { slots: SabnzbdQueueSlot[] } }>("queue");
    return data.queue.slots;
  },

  listHistory: async () => {
    const data = await sabnzbdCall<{ history: { slots: SabnzbdHistorySlot[] } }>("history");
    return data.history.slots;
  },

  deleteFromQueue: (nzoId: string) => sabnzbdCall<{ status: boolean }>("queue", { name: "delete", value: nzoId }),

  deleteFromHistory: (nzoId: string) =>
    sabnzbdCall<{ status: boolean }>("history", { name: "delete", value: nzoId }),

  pause: () => sabnzbdCall<{ status: boolean }>("pause"),
  resume: () => sabnzbdCall<{ status: boolean }>("resume"),
};
