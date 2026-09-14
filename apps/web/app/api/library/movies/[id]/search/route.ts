import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { radarr } from "@/lib/server/radarr";

export const dynamic = "force-dynamic";

// Plain "Search" -- Radarr searches and grabs automatically using its own
// configured quality profile. Distinct from /release (Interactive Search),
// which lists raw results for you to pick from yourself.
export const POST = async (_req: Request, ctx: { params: { id: string } }) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    await radarr.searchMovie(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 },
    );
  }
};
