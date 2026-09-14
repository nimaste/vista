import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { overseerr } from "@/lib/server/overseerr";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// Approve/reject is gone entirely -- that decision belongs to Overseerr's own
// admin UI now, not Vista. Only view + cancel remain, both pure passthrough.

export const GET = async (_req: Request, { params }: Params) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    const request = await overseerr.getRequest(id);
    return NextResponse.json({ request });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
};

export const DELETE = async (_req: Request, { params }: Params) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    await overseerr.cancelRequest(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cancel failed" },
      { status: 502 },
    );
  }
};
