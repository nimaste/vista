import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { radarr } from "@/lib/server/radarr";

export const dynamic = "force-dynamic";

export const GET = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const term = req.nextUrl.searchParams.get("term");
  if (!term || term.trim().length === 0)
    return NextResponse.json({ error: "term is required" }, { status: 400 });
  try {
    const results = await radarr.searchMovies(term.trim());
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 },
    );
  }
};
