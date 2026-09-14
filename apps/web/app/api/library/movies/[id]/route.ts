import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForRoute, requireUserForRoute } from "@/lib/server/auth";
import { radarr } from "@/lib/server/radarr";

export const dynamic = "force-dynamic";

export const GET = async (_req: Request, ctx: { params: { id: string } }) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    const movie = await radarr.getMovie(id);
    return NextResponse.json({
      movie: {
        id: String(movie.id),
        tmdbId: movie.tmdbId,
        title: movie.title,
        overview: movie.overview ?? null,
        year: movie.year ?? null,
        runtime: movie.runtime ?? null,
        // Proxied through Vista (and cached there), same as TV posters.
        posterPath: `/api/image/radarr/${movie.id}/poster`,
        backdropPath: `/api/image/radarr/${movie.id}/fanart`,
        monitored: movie.monitored,
        hasFile: movie.hasFile,
        filePath: movie.movieFile?.path ?? null,
        fileSizeBytes: movie.movieFile?.size ?? null,
        fileQuality: movie.movieFile?.quality?.quality?.name ?? null,
        releaseDate: null,
        qualityProfile: { id: String(movie.qualityProfileId), name: "" },
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
    await radarr.deleteMovie(id, deleteFiles);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 502 },
    );
  }
};
