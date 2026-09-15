import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { overseerr } from "@/lib/server/overseerr";

export const dynamic = "force-dynamic";

export const GET = async (req: NextRequest, ctx: { params: { studioId: string } }) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const studioId = Number(ctx.params.studioId);
  if (!Number.isInteger(studioId)) return NextResponse.json({ error: "Invalid studio id" }, { status: 400 });
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1") || 1;
  try {
    const data = await overseerr.moviesByStudio(studioId, page);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load" },
      { status: 502 },
    );
  }
};
