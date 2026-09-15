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
  posterPath?: string | null; // movie/tv
  profilePath?: string | null; // person -- TMDB's multi-search uses this field, not posterPath, for people
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

export type OverseerrPersonDetails = {
  id: number;
  name: string;
  biography?: string;
  profilePath?: string | null;
  birthday?: string | null;
  placeOfBirth?: string | null;
  knownForDepartment?: string;
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

const toBackdropUrl = (backdropPath?: string | null): string | null =>
  backdropPath ? `https://image.tmdb.org/t/p/w780${backdropPath}` : null;

const withPosterUrl = (r: OverseerrResult) => ({ ...r, posterUrl: toImageUrl(r.posterPath ?? r.profilePath) });

export type OverseerrGenre = { id: number; name: string; backdropUrl: string | null };

// Not an API-driven list -- Overseerr/Jellyseerr's own Discover homepage
// renders these as fixed rows (StudioSlider/NetworkSlider), same ids every
// install. Mirrored here rather than invented, so Vista's Discover tab
// shows the identical set the user already knows from Seerr's own UI.
export const STUDIOS = [
  { id: 2, name: "Disney" },
  { id: 127928, name: "20th Century Studios" },
  { id: 34, name: "Sony Pictures" },
  { id: 174, name: "Warner Bros. Pictures" },
  { id: 33, name: "Universal" },
  { id: 4, name: "Paramount" },
  { id: 3, name: "Pixar" },
  { id: 521, name: "Dreamworks" },
  { id: 420, name: "Marvel Studios" },
  { id: 9993, name: "DC" },
  { id: 41077, name: "A24" },
];

export const NETWORKS = [
  { id: 213, name: "Netflix" },
  { id: 2739, name: "Disney+" },
  { id: 1024, name: "Prime Video" },
  { id: 2552, name: "Apple TV+" },
  { id: 453, name: "Hulu" },
  { id: 49, name: "HBO" },
  { id: 4353, name: "Discovery+" },
  { id: 2, name: "ABC" },
  { id: 19, name: "FOX" },
  { id: 359, name: "Cinemax" },
  { id: 174, name: "AMC" },
  { id: 67, name: "Showtime" },
  { id: 318, name: "Starz" },
  { id: 71, name: "The CW" },
  { id: 6, name: "NBC" },
  { id: 16, name: "CBS" },
  { id: 4330, name: "Paramount+" },
  { id: 4, name: "BBC One" },
  { id: 56, name: "Cartoon Network" },
  { id: 80, name: "Adult Swim" },
  { id: 13, name: "Nickelodeon" },
  { id: 3353, name: "Peacock" },
];

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

  discoverUpcomingMovies: (page = 1) =>
    cached(`overseerr:discover:upcoming:movies:${page}`, 600, async () => {
      const data = await overseerrFetch<OverseerrPage>(`/discover/movies/upcoming?page=${page}`);
      return { ...data, results: data.results.map(withPosterUrl) };
    }),

  discoverUpcomingTv: (page = 1) =>
    cached(`overseerr:discover:upcoming:tv:${page}`, 600, async () => {
      const data = await overseerrFetch<OverseerrPage>(`/discover/tv/upcoming?page=${page}`);
      return { ...data, results: data.results.map(withPosterUrl) };
    }),

  movieGenres: (): Promise<OverseerrGenre[]> =>
    cached("overseerr:genres:movie", 3600, async () => {
      const data = await overseerrFetch<{ id: number; name: string; backdrops: string[] }[]>(
        "/discover/genreslider/movie",
      );
      return data.map((g) => ({ id: g.id, name: g.name, backdropUrl: toBackdropUrl(g.backdrops[0]) }));
    }),

  tvGenres: (): Promise<OverseerrGenre[]> =>
    cached("overseerr:genres:tv", 3600, async () => {
      const data = await overseerrFetch<{ id: number; name: string; backdrops: string[] }[]>(
        "/discover/genreslider/tv",
      );
      return data.map((g) => ({ id: g.id, name: g.name, backdropUrl: toBackdropUrl(g.backdrops[0]) }));
    }),

  moviesByGenre: (genreId: number, page = 1) =>
    cached(`overseerr:discover:movies:genre:${genreId}:${page}`, 600, async () => {
      const data = await overseerrFetch<OverseerrPage>(`/discover/movies/genre/${genreId}?page=${page}`);
      return { ...data, results: data.results.map(withPosterUrl) };
    }),

  tvByGenre: (genreId: number, page = 1) =>
    cached(`overseerr:discover:tv:genre:${genreId}:${page}`, 600, async () => {
      const data = await overseerrFetch<OverseerrPage>(`/discover/tv/genre/${genreId}?page=${page}`);
      return { ...data, results: data.results.map(withPosterUrl) };
    }),

  moviesByStudio: (studioId: number, page = 1) =>
    cached(`overseerr:discover:movies:studio:${studioId}:${page}`, 600, async () => {
      const data = await overseerrFetch<OverseerrPage>(`/discover/movies/studio/${studioId}?page=${page}`);
      return { ...data, results: data.results.map(withPosterUrl) };
    }),

  tvByNetwork: (networkId: number, page = 1) =>
    cached(`overseerr:discover:tv:network:${networkId}:${page}`, 600, async () => {
      const data = await overseerrFetch<OverseerrPage>(`/discover/tv/network/${networkId}?page=${page}`);
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

  // Overseerr/Jellyseerr proxy TMDB's /person endpoints under the same
  // API-key auth as everything else, so Vista never needs a direct TMDB key.
  getPerson: async (personId: number) => {
    const data = await overseerrFetch<OverseerrPersonDetails>(`/person/${personId}`);
    return { ...data, profileUrl: toImageUrl(data.profilePath) };
  },

  getPersonCredits: async (personId: number) => {
    const data = await overseerrFetch<{ cast: OverseerrResult[]; crew: OverseerrResult[] }>(
      `/person/${personId}/combined_credits`,
    );
    // Cast + crew can both list the same title (e.g. actor who also
    // produced) -- de-duplicate by (mediaType, id) so the filmography grid
    // doesn't show a movie twice, and drop anything without a poster
    // (talk-show appearances, shorts with no artwork) since the grid has
    // nothing to render for those.
    const seen = new Set<string>();
    const combined = [...data.cast, ...data.crew].filter((r) => {
      const key = `${r.mediaType}:${r.id}`;
      if (seen.has(key) || !r.posterPath) return false;
      seen.add(key);
      return true;
    });
    combined.sort((a, b) => (b.releaseDate ?? b.firstAirDate ?? "").localeCompare(a.releaseDate ?? a.firstAirDate ?? ""));
    return combined.map(withPosterUrl);
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
