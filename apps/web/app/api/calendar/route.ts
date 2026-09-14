import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { sonarr } from "@/lib/server/sonarr";
import { radarr } from "@/lib/server/radarr";

export const dynamic = "force-dynamic";

export const GET = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "ValidationError" }, { status: 400 });

  const [sonarrCal, radarrCal] = await Promise.all([
    sonarr.getCalendar(from, to).catch(() => []),
    radarr.getCalendar(from, to).catch(() => []),
  ]);

  const episodes = sonarrCal.map((e) => {
    const poster = e.series?.images?.find((i) => i.coverType === "poster");
    return {
      id: String(e.id),
      seriesId: String(e.seriesId),
      seriesTitle: e.series?.title ?? "",
      posterPath: poster?.remoteUrl ?? null,
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      episodeTitle: e.title,
      overview: e.overview ?? null,
      airDate: e.airDateUtc ?? e.airDate,
      hasFile: e.hasFile,
    };
  });

  const movies = radarrCal.map((m) => {
    const poster = m.images?.find((i) => i.coverType === "poster");
    return {
      id: String(m.id),
      title: m.title,
      year: m.year,
      releaseDate: m.digitalRelease ?? m.physicalRelease ?? m.inCinemas ?? null,
      posterPath: poster?.remoteUrl ?? null,
      hasFile: m.hasFile,
    };
  });

  return NextResponse.json({ episodes, movies });
};
