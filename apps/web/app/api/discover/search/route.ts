import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUserForRoute } from "@/lib/server/auth";
import { overseerr } from "@/lib/server/overseerr";

const schema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export const GET = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const parsed = schema.safeParse({
    q: url.searchParams.get("q") ?? "",
    page: url.searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "ValidationError" }, { status: 400 });
  try {
    const data = await overseerr.search(parsed.data.q, parsed.data.page);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 },
    );
  }
};
