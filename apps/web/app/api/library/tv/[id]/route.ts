import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForRoute, requireUserForRoute } from "@/lib/server/auth";
import { sonarr } from "@/lib/server/sonarr";

export const dynamic = "force-dynamic";

export const GET = async (_req: Request, ctx: { params: { id: string } }) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    const [s, episodes] = await Promise.all([
      sonarr.getSeries(id),
      sonarr.getEpisodes(id),
    ]);
    const posterPath = `/api/image/sonarr/${s.id}/poster`;
    const backdropPath = `/api/image/sonarr/${s.id}/fanart`;

    // Group episodes by season number
    const episodesBySeason = new Map<number, typeof episodes>();
    for (const ep of episodes) {
      const list = episodesBySeason.get(ep.seasonNumber) ?? [];
      list.push(ep);
      episodesBySeason.set(ep.seasonNumber, list);
    }

    return NextResponse.json({
      series: {
        id: String(s.id),
        tvdbId: s.tvdbId,
        title: s.title,
        overview: s.overview ?? null,
        year: s.year ?? null,
        posterPath,
        backdropPath,
        monitored: s.monitored,
        status: s.status,
        seasonCount: s.statistics?.seasonCount ?? 0,
        episodeFileCount: s.statistics?.episodeFileCount ?? 0,
        episodeCount: s.statistics?.episodeCount ?? 0,
        qualityProfile: { id: String(s.qualityProfileId), name: "" },
        seasons: (s.seasons ?? []).map((season) => ({
          seasonNumber: season.seasonNumber,
          monitored: season.monitored,
          episodeFileCount: season.statistics?.episodeFileCount ?? 0,
          episodeCount: season.statistics?.episodeCount ?? 0,
          totalEpisodeCount: season.statistics?.totalEpisodeCount ?? 0,
          episodes: (episodesBySeason.get(season.seasonNumber) ?? []).map((ep) => ({
            id: String(ep.id),
            episodeNumber: ep.episodeNumber,
            title: ep.title ?? null,
            airDate: ep.airDate ?? null,
            overview: ep.overview ?? null,
            monitored: ep.monitored,
            hasFile: ep.hasFile,
            fileQuality: ep.episodeFile?.quality?.quality?.name ?? null,
            fileSizeBytes: ep.episodeFile?.size ?? null,
          })),
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: "NotFound" }, { status: 404 });
  }
};

export const DELETE = async (req: NextRequest, ctx: { params: { id: string } }) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  const deleteFiles = new URL(req.url).searchParams.get("deleteFiles") === "true";
  try {
    await sonarr.deleteSeries(id, deleteFiles);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 502 },
    );
  }
};
