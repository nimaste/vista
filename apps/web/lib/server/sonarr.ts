import "server-only";
import { cached, invalidate } from "./cache";
import { getConnection } from "./connections";

type SonarrConfig = { url: string; apiKey: string };

const getConfig = async (): Promise<SonarrConfig | null> => {
  const conn = await getConnection("SONARR");
  if (!conn || !conn.apiKey) return null;
  return { url: conn.baseUrl, apiKey: conn.apiKey };
};

class SonarrError extends Error {
  override name = "SonarrError";
  constructor(public status: number, message: string) {
    super(message);
  }
}

const sonarrFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const cfg = await getConfig();
  if (!cfg) throw new SonarrError(503, "Sonarr not configured");
  const url = `${cfg.url}/api/v3${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-Api-Key": cfg.apiKey,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SonarrError(res.status, `Sonarr ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
};

// -- Types matching Sonarr v3 API responses --

export type SonarrSeries = {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  overview: string;
  year: number;
  path: string;
  tvdbId: number;
  imdbId?: string;
  titleSlug: string;
  monitored: boolean;
  qualityProfileId: number;
  seasonFolder: boolean;
  rootFolderPath: string;
  added: string;
  statistics?: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
  images?: { coverType: string; remoteUrl?: string; url?: string }[];
  seasons?: { seasonNumber: number; monitored: boolean; statistics?: { episodeFileCount: number; episodeCount: number; totalEpisodeCount: number } }[];
};

export type SonarrEpisode = {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeNumber: number;
  seasonNumber: number;
  title: string;
  airDate: string | null;
  airDateUtc: string | null;
  overview: string | null;
  hasFile: boolean;
  monitored: boolean;
};

export type SonarrEpisodeDetail = {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeNumber: number;
  seasonNumber: number;
  title: string;
  airDate: string | null;
  airDateUtc: string | null;
  overview: string | null;
  hasFile: boolean;
  monitored: boolean;
  episodeFileId: number;
  episodeFile?: {
    quality: { quality: { name: string } };
    size: number;
    relativePath: string;
  };
};

export type SonarrCalendarItem = SonarrEpisode & {
  series: SonarrSeries;
};

export type SonarrRootFolder = {
  id: number;
  path: string;
  freeSpace: number;
};

export type SonarrQualityProfile = {
  id: number;
  name: string;
};

// Interactive Search result -- one available release for an episode. Grabbing
// one (pushRelease) is also how "search for an upgrade" works: call it against
// an episode that already has a file, same endpoint, no separate upgrade path.
export type SonarrRelease = {
  guid: string;
  indexerId: number;
  title: string;
  size: number;
  quality: { quality: { name: string } };
  seeders?: number;
  leechers?: number;
  age: number;
  rejected: boolean;
  rejections?: string[];
  protocol: "usenet" | "torrent";
};

export type SonarrAddOptions = {
  tvdbId: number;
  title: string;
  titleSlug?: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored?: boolean;
  seasonFolder?: boolean;
  seasons?: { seasonNumber: number; monitored: boolean }[];
  addOptions?: { searchForMissingEpisodes?: boolean };
};

// -- Exported API --

export const sonarr = {
  isConfigured: async (): Promise<boolean> => {
    return (await getConfig()) !== null;
  },

  testConnection: async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const data = await sonarrFetch<{ version: string }>("/system/status");
      return { ok: true, message: `Sonarr v${data.version}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  listSeries: () =>
    cached("sonarr:series", 300, () => sonarrFetch<SonarrSeries[]>("/series")),

  getSeries: (id: number) =>
    sonarrFetch<SonarrSeries>(`/series/${id}`),

  getEpisodes: (seriesId: number) =>
    sonarrFetch<SonarrEpisodeDetail[]>(`/episode?seriesId=${seriesId}&includeEpisodeFile=true`),

  // Free-text search for the "add a new show" flow -- Sonarr's own lookup
  // already resolves title text straight to tvdbId, no separate TMDB
  // translation step needed.
  searchSeries: (term: string) =>
    sonarrFetch<SonarrSeries[]>(`/series/lookup?term=${encodeURIComponent(term)}`),

  addSeries: async (params: SonarrAddOptions): Promise<SonarrSeries> => {
    const slug = params.titleSlug ?? params.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const body = {
      tvdbId: params.tvdbId,
      title: params.title,
      titleSlug: slug,
      qualityProfileId: params.qualityProfileId,
      rootFolderPath: params.rootFolderPath,
      monitored: params.monitored ?? true,
      seasonFolder: params.seasonFolder ?? true,
      seasons: params.seasons ?? [],
      addOptions: params.addOptions ?? { searchForMissingEpisodes: true },
    };
    const result = await sonarrFetch<SonarrSeries>("/series", {
      method: "POST",
      body: JSON.stringify(body),
    });
    invalidate("sonarr:series");
    invalidate("arr:tvdbIds");
    return result;
  },

  getCalendar: (start: string, end: string) =>
    cached(`sonarr:calendar:${start}:${end}`, 300, () =>
      sonarrFetch<SonarrCalendarItem[]>(`/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&includeSeries=true`),
    ),

  getRootFolders: () =>
    cached("sonarr:rootfolders", 3600, () => sonarrFetch<SonarrRootFolder[]>("/rootfolder")),

  getQualityProfiles: () =>
    cached("sonarr:qualityprofiles", 3600, () => sonarrFetch<SonarrQualityProfile[]>("/qualityprofile")),

  deleteSeries: async (id: number, deleteFiles: boolean): Promise<void> => {
    await sonarrFetch<void>(`/series/${id}?deleteFiles=${deleteFiles}`, { method: "DELETE" });
    invalidate("sonarr:series");
    invalidate("arr:tvdbIds");
  },

  // Interactive Search -- lists every release currently available for an
  // episode. Same call whether the episode is missing or already has a file
  // (i.e. this doubles as the "search for an upgrade" UI with no separate code path).
  getReleases: (episodeId: number) =>
    sonarrFetch<SonarrRelease[]>(`/release?episodeId=${episodeId}`, {
      // Interactive search hits real indexers -- can genuinely take a while.
      signal: AbortSignal.timeout(60_000),
    }),

  pushRelease: async (release: Pick<SonarrRelease, "guid" | "indexerId">): Promise<void> => {
    await sonarrFetch<void>("/release/push", {
      method: "POST",
      body: JSON.stringify({ guid: release.guid, indexerId: release.indexerId }),
    });
  },
};
