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

// Grabs a release chosen from GET's results. The body is the *entire*
// release object as GET returned it -- Radarr's own /release/push needs the
// full thing (title, downloadUrl/magnetUrl, protocol, publishDate, etc.),
// not just guid/indexerId.
export const POST = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object" || !("guid" in body))
    return NextResponse.json({ error: "A full release object is required" }, { status: 400 });
  try {
    await radarr.pushRelease(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grab failed" },
      { status: 502 },
    );
  }
};
