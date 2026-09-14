import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUserForRoute } from "@/lib/server/auth";
import { sonarr } from "@/lib/server/sonarr";
import type { LibrarySeriesListItem } from "@/lib/types";

// tvdbId (not tmdbId) -- comes straight from /api/library/tv/search results,
// which are Sonarr's own lookup results and already carry the right ID
// scheme for adding to Sonarr. No TMDB translation step needed.
const addSchema = z.object({
  tvdbId: z.number().int().positive(),
  title: z.string().min(1),
  qualityProfileId: z.number().int().positive().optional(),
  rootFolderPath: z.string().min(1).optional(),
});

export const GET = async () => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const raw = await sonarr.listSeries();
    const series: LibrarySeriesListItem[] = raw.map((s) => ({
      id: String(s.id),
      tmdbId: 0,
      tvdbId: s.tvdbId,
      title: s.title,
      overview: s.overview ?? null,
      year: s.year ?? null,
      posterPath: `/api/image/sonarr/${s.id}/poster`,
      backdropPath: `/api/image/sonarr/${s.id}/fanart`,
      monitored: s.monitored,
      status: s.status,
      seasonCount: s.statistics?.seasonCount ?? 0,
      episodeFileCount: s.statistics?.episodeFileCount ?? 0,
      episodeCount: s.statistics?.episodeCount ?? 0,
      qualityProfile: { id: String(s.qualityProfileId), name: "" },
    }));
    return NextResponse.json({ series });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not configured")) {
      return NextResponse.json({ series: [] });
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
    // Sonarr's own configuration is the only source of truth here -- Vista
    // never stores an opinion about quality profiles/root folders. If the
    // client didn't specify one, fall through to Sonarr's live first option.
    if (!qualityProfileId || !rootFolderPath) {
      const [profiles, rootFolders] = await Promise.all([sonarr.getQualityProfiles(), sonarr.getRootFolders()]);
      if (!qualityProfileId) qualityProfileId = profiles[0]?.id;
      if (!rootFolderPath) rootFolderPath = rootFolders[0]?.path;
    }
    if (!qualityProfileId || !rootFolderPath) {
      return NextResponse.json({ error: "No quality profile or root folder configured in Sonarr" }, { status: 400 });
    }
    const series = await sonarr.addSeries({
      tvdbId: parsed.data.tvdbId,
      title: parsed.data.title,
      qualityProfileId,
      rootFolderPath,
      addOptions: { searchForMissingEpisodes: true },
    });
    return NextResponse.json({ series: { id: String(series.id), tvdbId: series.tvdbId, title: series.title } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add series" }, { status: 500 });
  }
};
