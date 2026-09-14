import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUserForRoute } from "@/lib/server/auth";
import { overseerr } from "@/lib/server/overseerr";

export const dynamic = "force-dynamic";

// Pure passthrough to the connected Overseerr/Jellyseerr instance -- Vista
// used to reimplement request/approval itself (MediaRequest model, its own
// auto-approve logic, direct Radarr/Sonarr add calls). That's gone: Overseerr
// owns the whole request lifecycle now, including handing an approved
// request off to the configured Radarr/Sonarr. Vista only displays status.

export const GET = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const filterParam = req.nextUrl.searchParams.get("filter");
  const filter = (["all", "pending", "approved", "available"] as const).includes(filterParam as never)
    ? (filterParam as "all" | "pending" | "approved" | "available")
    : "all";
  try {
    const data = await overseerr.getRequests(filter);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load requests" },
      { status: 502 },
    );
  }
};

const createSchema = z.object({
  mediaType: z.enum(["movie", "tv"]),
  mediaId: z.number().int().positive(), // tmdbId
  seasons: z.union([z.array(z.number().int()), z.literal("all")]).optional(),
});

export const POST = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });

  try {
    const request = await overseerr.submitRequest(parsed.data);
    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 502 },
    );
  }
};
