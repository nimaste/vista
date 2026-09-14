import "server-only";
import { cached } from "./cache";
import { getConnection } from "./connections";

type OverseerrConfig = { url: string; apiKey: string };

const getConfig = async (): Promise<OverseerrConfig | null> => {
  const conn = await getConnection("OVERSEERR");
  if (!conn || !conn.apiKey) return null;
  return { url: conn.baseUrl, apiKey: conn.apiKey };
};

class OverseerrError extends Error {
  override name = "OverseerrError";
  constructor(public status: number, message: string) {
    super(message);
  }
}

const overseerrFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const cfg = await getConfig();
  if (!cfg) throw new OverseerrError(503, "Overseerr not configured");
  const url = `${cfg.url}/api/v1${path}`;
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
    throw new OverseerrError(res.status, `Overseerr ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
};

// -- Types matching Overseerr/Jellyseerr's REST API --
// Numeric mediaInfo.status: 1 UNKNOWN, 2 PENDING, 3 PROCESSING, 4 PARTIALLY_AVAILABLE, 5 AVAILABLE.

export type OverseerrMediaInfo = {
  id: number;
  status: number;
  requests?: { id: number; status: number }[];
};

export type OverseerrResult = {
  id: number; // tmdbId
  mediaType: "movie" | "tv" | "person";
  title?: string; // movie
  name?: string; // tv/person
  overview?: string;
  posterPath?: string | null;
  releaseDate?: string; // movie
  firstAirDate?: string; // tv
  mediaInfo?: OverseerrMediaInfo;
};

export type OverseerrPage = {
  page: number;
  totalPages: number;
  totalResults: number;
  results: OverseerrResult[];
};

export type OverseerrDetails = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  releaseDate?: string;
  firstAirDate?: string;
  runtime?: number;
  genres?: { id: number; name: string }[];
  mediaInfo?: OverseerrMediaInfo;
  watchProviders?: unknown;
};

export type OverseerrRequestStatus = {
  id: number;
  status: number; // 1 pending, 2 approved, 3 declined
  media: { tmdbId: number; mediaType: "movie" | "tv"; status: number };
  requestedBy?: { displayName?: string; email?: string };
  seasons?: { seasonNumber: number }[];
  createdAt: string;
};

export type OverseerrRequestPage = {
  pageInfo: { pages: number; results: number };
  results: OverseerrRequestStatus[];
};

const toImageUrl = (posterPath?: string | null): string | null =>
  posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;

const withPosterUrl = (r: OverseerrResult) => ({ ...r, posterUrl: toImageUrl(r.posterPath) });

// -- Exported API --

export const overseerr = {
  isConfigured: async (): Promise<boolean> => (await getConfig()) !== null,

  testConnection: async (): Promise<{ ok: boolean; message: string }> => {
    try {
      const data = await overseerrFetch<{ version: string }>("/status");
      return { ok: true, message: `Overseerr/Jellyseerr v${data.version}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Unknown error" };
    }
  },

  discoverMovies: (page = 1) =>
    cached(`overseerr:discover:movies:${page}`, 600, async () => {
      const data = await overseerrFetch<OverseerrPage>(`/discover/movies?page=${page}`);
      return { ...data, results: data.results.map(withPosterUrl) };
    }),

  discoverTv: (page = 1) =>
    cached(`overseerr:discover:tv:${page}`, 600, async () => {
      const data = await overseerrFetch<OverseerrPage>(`/discover/tv?page=${page}`);
      return { ...data, results: data.results.map(withPosterUrl) };
    }),

  discoverTrending: (page = 1) =>
    cached(`overseerr:discover:trending:${page}`, 600, async () => {
      const data = await overseerrFetch<OverseerrPage>(`/discover/trending?page=${page}`);
      return { ...data, results: data.results.map(withPosterUrl) };
    }),

  getDetails: async (mediaType: "movie" | "tv", tmdbId: number): Promise<OverseerrDetails & { posterUrl: string | null; backdropUrl: string | null }> => {
    const data = await overseerrFetch<OverseerrDetails>(`/${mediaType}/${tmdbId}`);
    return {
      ...data,
      posterUrl: toImageUrl(data.posterPath),
      backdropUrl: data.backdropPath ? `https://image.tmdb.org/t/p/w1280${data.backdropPath}` : null,
    };
  },

  search: async (query: string, page = 1) => {
    const data = await overseerrFetch<OverseerrPage>(
      `/search?query=${encodeURIComponent(query)}&page=${page}`,
    );
    return { ...data, results: data.results.map(withPosterUrl) };
  },

  // Submits the request TO Overseerr -- Overseerr itself hands the approved
  // request off to the connected Radarr/Sonarr. Vista never calls
  // Radarr/Sonarr directly for a request.
  submitRequest: (params: {
    mediaType: "movie" | "tv";
    mediaId: number;
    seasons?: number[] | "all";
  }) =>
    overseerrFetch<OverseerrRequestStatus>("/request", {
      method: "POST",
      body: JSON.stringify({
        mediaType: params.mediaType,
        mediaId: params.mediaId,
        seasons: params.seasons,
      }),
    }),

  getRequests: (filter: "all" | "pending" | "approved" | "available" = "all") =>
    overseerrFetch<OverseerrRequestPage>(`/request?take=50&filter=${filter}&sort=added`),

  getRequest: (id: number) => overseerrFetch<OverseerrRequestStatus>(`/request/${id}`),

  // Cancels a pending request. Approving/declining stays entirely inside
  // Overseerr's own UI -- Vista only ever displays status, never decides it.
  cancelRequest: async (id: number): Promise<void> => {
    await overseerrFetch<void>(`/request/${id}`, { method: "DELETE" });
  },
};
