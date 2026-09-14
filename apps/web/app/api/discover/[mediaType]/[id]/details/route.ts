import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { overseerr } from "@/lib/server/overseerr";

// Overseerr's own detail endpoint already carries mediaInfo.status (whether
// it's in the library/requested/available), so the separate arr-cache
// library-membership check this route used to do against TMDB is gone --
// Overseerr already knows, since it's the thing that requested it.
export const GET = async (_req: Request, ctx: { params: { mediaType: string; id: string } }) => {
  if (!(await requireUserForRoute())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { mediaType, id } = ctx.params;
  if (mediaType !== "movie" && mediaType !== "tv") {
    return NextResponse.json({ error: "ValidationError", message: "mediaType must be movie or tv" }, { status: 400 });
  }
  const tmdbId = Number(id);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "ValidationError", message: "id must be a positive integer" }, { status: 400 });
  }
  try {
    const details = await overseerr.getDetails(mediaType, tmdbId);
    return NextResponse.json({ details });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load" },
      { status: 502 },
    );
  }
};
