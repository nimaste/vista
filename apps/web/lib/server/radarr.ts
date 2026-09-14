import "server-only";
import { cached, invalidate } from "./cache";
import { getConnection } from "./connections";

type RadarrConfig = { url: string; apiKey: string };

const getConfig = async (): Promise<RadarrConfig | null> => {
  const conn = await getConnection("RADARR");
  if (!conn || !conn.apiKey) return null;
  return { url: conn.baseUrl, apiKey: conn.apiKey };
};

class RadarrError extends Error {
  override name = "RadarrError";
  constructor(public status: number, message: string) {
    super(message);
  }
}

const radarrFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const cfg = await getConfig();
  if (!cfg) throw new RadarrError(503, "Radarr not configured");
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
    throw new RadarrError(res.status, `Radarr ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
};

// -- Types matching Radarr v3 API responses --

export type RadarrMovie = {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  overview: string;
  year: number;
  path: string;
  tmdbId: number;
  imdbId?: string;
  titleSlug: string;
  monitored: boolean;
  qualityProfileId: number;
  rootFolderPath: string;
  added: string;
  hasFile: boolean;
  runtime: number;
  sizeOnDisk: number;
  images?: { coverType: string; remoteUrl?: string; url?: string }[];
  movieFile?: {
    relativePath: string;
    path: string;
    size: number;
    quality: { quality: { name: string } };
  };
};

export type RadarrCalendarItem = RadarrMovie & {
  inCinemas?: string;
  physicalRelease?: string;
  digitalRelease?: string;
};

export type RadarrRootFolder = {
  id: number;
  path: string;
  freeSpace: number;
};

export type RadarrQualityProfile = {
  id: number;
  name: string;
};

export type RadarrAddOptions = {
  tmdbId: number;
  title: string;
  titleSlug?: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored?: boolean;
  addOptions?: { searchForMovie?: boolean };
};

// Interactive Search result -- same shape/semantics as Sonarr's: grabbing one
// against an already-downloaded movie is how "search for an upgrade" works too.
export type RadarrRelease = {
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

// -- Exported API --

export const radarr = {
  isConfigured: async (): Promise<boolean> => {
    return (await getConfig()) !== null;
  },

  testConnection: async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const data = await radarrFetch<{ version: string }>("/system/status");
      return { ok: true, message: `Radarr v${data.version}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  listMovies: () =>
    cached("radarr:movies", 300, () => radarrFetch<RadarrMovie[]>("/movie")),

  getMovie: (id: number) =>
    radarrFetch<RadarrMovie>(`/movie/${id}`),

  // Free-text search for the "add a new movie" flow.
  searchMovies: (term: string) =>
    radarrFetch<RadarrMovie[]>(`/movie/lookup?term=${encodeURIComponent(term)}`),

  addMovie: async (params: RadarrAddOptions): Promise<RadarrMovie> => {
    const slug = params.titleSlug ?? params.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const body = {
      tmdbId: params.tmdbId,
      title: params.title,
      titleSlug: slug,
      qualityProfileId: params.qualityProfileId,
      rootFolderPath: params.rootFolderPath,
      monitored: params.monitored ?? true,
      addOptions: params.addOptions ?? { searchForMovie: true },
    };
    const result = await radarrFetch<RadarrMovie>("/movie", {
      method: "POST",
      body: JSON.stringify(body),
    });
    invalidate("radarr:movies");
    invalidate("arr:tmdbIds");
    return result;
  },

  getCalendar: (start: string, end: string) =>
    cached(`radarr:calendar:${start}:${end}`, 300, () =>
      radarrFetch<RadarrCalendarItem[]>(`/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
    ),

  getRootFolders: () =>
    cached("radarr:rootfolders", 3600, () => radarrFetch<RadarrRootFolder[]>("/rootfolder")),

  getQualityProfiles: () =>
    cached("radarr:qualityprofiles", 3600, () => radarrFetch<RadarrQualityProfile[]>("/qualityprofile")),

  deleteMovie: async (id: number, deleteFiles: boolean): Promise<void> => {
    await radarrFetch<void>(`/movie/${id}?deleteFiles=${deleteFiles}`, { method: "DELETE" });
    invalidate("radarr:movies");
    invalidate("arr:tmdbIds");
  },

  getReleases: (movieId: number) =>
    radarrFetch<RadarrRelease[]>(`/release?movieId=${movieId}`, {
      signal: AbortSignal.timeout(60_000),
    }),

  // Radarr's /release/push wants the *entire* release object back exactly
  // as /release returned it -- guid/indexerId alone gets rejected with
  // "Title/DownloadUrl/MagnetUrl/Protocol/PublishDate must not be empty."
  // The client round-trips the whole object it received from getReleases,
  // same as Radarr's own web UI does.
  pushRelease: async (release: unknown): Promise<void> => {
    await radarrFetch<void>("/release/push", {
      method: "POST",
      body: JSON.stringify(release),
    });
  },

  // Plain "Search" -- Radarr picks and grabs automatically using the
  // movie's own configured quality profile. Distinct from Interactive
  // Search (getReleases/pushRelease above), which hands you the raw
  // indexer results to choose from yourself.
  searchMovie: async (movieId: number): Promise<void> => {
    await radarrFetch<void>("/command", {
      method: "POST",
      body: JSON.stringify({ name: "MoviesSearch", movieIds: [movieId] }),
    });
  },
};
