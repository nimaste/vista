export type LibraryMovie = {
  id: string;
  tmdbId: number;
  title: string;
  overview: string | null;
  year: number | null;
  runtime: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  monitored: boolean;
  hasFile: boolean;
  filePath: string | null;
  fileSizeBytes: number | null;
  fileQuality: string | null;
  releaseDate: string | null;
  qualityProfile: { id: string; name: string } | null;
};

export type LibrarySeriesListItem = {
  id: string;
  tmdbId: number;
  tvdbId: number;
  title: string;
  overview: string | null;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  monitored: boolean;
  status: string;
  seasonCount: number;
  episodeFileCount: number;
  episodeCount: number;
  qualityProfile: { id: string; name: string } | null;
};
