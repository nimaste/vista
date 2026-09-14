import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUserForRoute } from "@/lib/server/auth";
import { radarr } from "@/lib/server/radarr";
import type { LibraryMovie } from "@/lib/types";

const addSchema = z.object({
  tmdbId: z.number().int().positive(),
  title: z.string().min(1),
  qualityProfileId: z.number().int().positive().optional(),
  rootFolderPath: z.string().min(1).optional(),
});

export const GET = async () => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const raw = await radarr.listMovies();
    const movies: LibraryMovie[] = raw.map((m) => {
      const poster = m.images?.find((i) => i.coverType === "poster");
      const fanart = m.images?.find((i) => i.coverType === "fanart");
      return {
        id: String(m.id),
        tmdbId: m.tmdbId,
        title: m.title,
        overview: m.overview ?? null,
        year: m.year ?? null,
        runtime: m.runtime ?? null,
        posterPath: poster?.remoteUrl ?? null,
        backdropPath: fanart?.remoteUrl ?? null,
        monitored: m.monitored,
        hasFile: m.hasFile,
        filePath: m.movieFile?.path ?? null,
        fileSizeBytes: m.movieFile?.size ?? null,
        fileQuality: m.movieFile?.quality?.quality?.name ?? null,
        releaseDate: null,
        qualityProfile: { id: String(m.qualityProfileId), name: "" },
      };
    });
    return NextResponse.json({ movies });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not configured")) {
      return NextResponse.json({ movies: [] });
    }
    throw err;
  }
};

export const POST = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = addSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ValidationError" }, { status: 400 });
  try {
    let qualityProfileId = parsed.data.qualityProfileId;
    let rootFolderPath = parsed.data.rootFolderPath;
    // Radarr's own configuration is the only source of truth here -- Vista
    // never stores an opinion about quality profiles/root folders. If the
    // client didn't specify one, fall through to Radarr's live first option.
    if (!qualityProfileId || !rootFolderPath) {
      const [profiles, rootFolders] = await Promise.all([radarr.getQualityProfiles(), radarr.getRootFolders()]);
      if (!qualityProfileId) qualityProfileId = profiles[0]?.id;
      if (!rootFolderPath) rootFolderPath = rootFolders[0]?.path;
    }
    if (!qualityProfileId || !rootFolderPath) {
      return NextResponse.json({ error: "No quality profile or root folder configured in Radarr" }, { status: 400 });
    }
    const movie = await radarr.addMovie({
      tmdbId: parsed.data.tmdbId,
      title: parsed.data.title,
      qualityProfileId,
      rootFolderPath,
      addOptions: { searchForMovie: true },
    });
    return NextResponse.json({ movie: { id: String(movie.id), tmdbId: movie.tmdbId, title: movie.title } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add movie" }, { status: 500 });
  }
};
