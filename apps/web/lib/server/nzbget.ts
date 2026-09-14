import "server-only";
import { getConnection } from "./connections";

type NzbgetConfig = { url: string; username: string; password: string };

const getConfig = async (): Promise<NzbgetConfig | null> => {
  const conn = await getConnection("NZBGET");
  if (!conn || !conn.username || !conn.password) return null;
  return { url: conn.baseUrl, username: conn.username, password: conn.password };
};

class NzbgetError extends Error {
  override name = "NzbgetError";
  constructor(public status: number, message: string) {
    super(message);
  }
}

// NZBGet's own docs use http://user:pass@host/jsonrpc -- deliberately using
// HTTP Basic Auth headers against the plain URL instead, so credentials never
// end up embedded in a URL that could land in logs or error messages.
const nzbgetCall = async <T>(method: string, params: unknown[] = []): Promise<T> => {
  const cfg = await getConfig();
  if (!cfg) throw new NzbgetError(503, "NZBGet not configured");
  const res = await fetch(`${cfg.url}/jsonrpc`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ method, params, id: 1 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new NzbgetError(res.status, `NZBGet ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new NzbgetError(502, `NZBGet: ${json.error.message}`);
  return json.result as T;
};

// -- Types --

export type NzbgetQueueItem = {
  NZBID: number;
  NZBName: string;
  Status: string; // DOWNLOADING | PAUSED | QUEUED | ...
  FileSizeMB: number;
  RemainingSizeMB: number;
  DownloadedSizeMB: number;
};

export type NzbgetHistoryItem = {
  NZBID: number;
  Name: string;
  Status: string; // SUCCESS/... | FAILURE/... | DELETED
  FileSizeMB: number;
  HistoryTime: number; // unix seconds
};

// -- Exported API --

export const nzbget = {
  isConfigured: async (): Promise<boolean> => (await getConfig()) !== null,

  testConnection: async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const version = await nzbgetCall<string>("version");
      return { ok: true, message: `NZBGet v${version}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  listQueue: () => nzbgetCall<NzbgetQueueItem[]>("listgroups"),

  listHistory: () => nzbgetCall<NzbgetHistoryItem[]>("history", [false]),

  deleteFromQueue: (nzbId: number) => nzbgetCall<boolean>("editqueue", ["GroupDelete", "", [nzbId]]),

  deleteFromHistory: (nzbId: number) => nzbgetCall<boolean>("editqueue", ["HistoryDelete", "", [nzbId]]),

  pause: () => nzbgetCall<boolean>("pausedownload"),
  resume: () => nzbgetCall<boolean>("resumedownload"),
};
