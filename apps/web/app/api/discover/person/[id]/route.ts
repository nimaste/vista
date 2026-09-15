import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { overseerr } from "@/lib/server/overseerr";

export const GET = async (_req: Request, ctx: { params: { id: string } }) => {
  if (!(await requireUserForRoute())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const personId = Number(ctx.params.id);
  if (!Number.isInteger(personId) || personId <= 0) {
    return NextResponse.json({ error: "ValidationError", message: "id must be a positive integer" }, { status: 400 });
  }
  try {
    const [person, credits] = await Promise.all([
      overseerr.getPerson(personId),
      overseerr.getPersonCredits(personId),
    ]);
    return NextResponse.json({ person, credits });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load" },
      { status: 502 },
    );
  }
};
