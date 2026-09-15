import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { overseerr } from "@/lib/server/overseerr";

export const dynamic = "force-dynamic";

export const GET = async (req: NextRequest, ctx: { params: { genreId: string } }) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const genreId = Number(ctx.params.genreId);
  if (!Number.isInteger(genreId)) return NextResponse.json({ error: "Invalid genre id" }, { status: 400 });
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1") || 1;
  try {
    const data = await overseerr.tvByGenre(genreId, page);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load" },
      { status: 502 },
    );
  }
};
