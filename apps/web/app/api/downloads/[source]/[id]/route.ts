import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { downloads } from "@/lib/server/downloads";

export const dynamic = "force-dynamic";

const isSource = (v: string): v is "nzbget" | "sabnzbd" => v === "nzbget" || v === "sabnzbd";

// DELETE /api/downloads/{source}/{id}?from=queue|history
export const DELETE = async (req: NextRequest, ctx: { params: { source: string; id: string } }) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { source, id } = ctx.params;
  if (!isSource(source)) return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  const from = new URL(req.url).searchParams.get("from") === "history" ? "history" : "queue";
  try {
    if (from === "history") await downloads.deleteHistoryItem(source, id);
    else await downloads.deleteQueueItem(source, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 502 },
    );
  }
};
