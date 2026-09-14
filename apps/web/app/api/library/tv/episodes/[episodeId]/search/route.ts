import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { sonarr } from "@/lib/server/sonarr";

export const dynamic = "force-dynamic";

// Plain "Search" -- Sonarr searches and grabs automatically using its own
// configured quality profile. Distinct from /release (Interactive Search),
// which lists raw results for you to pick from yourself.
export const POST = async (_req: Request, ctx: { params: { episodeId: string } }) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const episodeId = Number(ctx.params.episodeId);
  if (!Number.isInteger(episodeId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    await sonarr.searchEpisode(episodeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 },
    );
  }
};
