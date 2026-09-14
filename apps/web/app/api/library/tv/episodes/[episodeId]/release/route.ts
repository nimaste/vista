import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { sonarr } from "@/lib/server/sonarr";

export const dynamic = "force-dynamic";

// Interactive Search for one episode -- same endpoint doubles as "search for
// an upgrade" when called against an episode that already has a file.
export const GET = async (_req: Request, ctx: { params: { episodeId: string } }) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const episodeId = Number(ctx.params.episodeId);
  if (!Number.isInteger(episodeId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    const releases = await sonarr.getReleases(episodeId);
    return NextResponse.json({ releases });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 },
    );
  }
};

export const POST = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const guid = body.guid as string | undefined;
  const indexerId = body.indexerId as number | undefined;
  if (!guid || typeof indexerId !== "number")
    return NextResponse.json({ error: "guid and indexerId are required" }, { status: 400 });
  try {
    await sonarr.pushRelease({ guid, indexerId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grab failed" },
      { status: 502 },
    );
  }
};
