import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { radarr } from "@/lib/server/radarr";

export const dynamic = "force-dynamic";

// Interactive Search -- lists releases currently available for this movie.
// Same endpoint whether the movie is missing or already downloaded, so this
// also serves as "search for an upgrade" with no separate UI/route.
export const GET = async (_req: Request, ctx: { params: { id: string } }) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    const releases = await radarr.getReleases(id);
    return NextResponse.json({ releases });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 },
    );
  }
};

// Grabs (downloads) a specific release chosen from GET's results.
export const POST = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const guid = body.guid as string | undefined;
  const indexerId = body.indexerId as number | undefined;
  if (!guid || typeof indexerId !== "number")
    return NextResponse.json({ error: "guid and indexerId are required" }, { status: 400 });
  try {
    await radarr.pushRelease({ guid, indexerId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grab failed" },
      { status: 502 },
    );
  }
};
