import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { sonarr } from "@/lib/server/sonarr";
import { radarr } from "@/lib/server/radarr";

export const dynamic = "force-dynamic";

export const GET = async (req: NextRequest) => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mediaType = new URL(req.url).searchParams.get("mediaType");

  const result: {
    sonarr: { profiles: { id: number; name: string }[]; rootFolders: { id: number; path: string }[] } | null;
    radarr: { profiles: { id: number; name: string }[]; rootFolders: { id: number; path: string }[] } | null;
  } = { sonarr: null, radarr: null };

  if (!mediaType || mediaType === "TV") {
    try {
      const [profiles, rootFolders] = await Promise.all([
        sonarr.getQualityProfiles(),
        sonarr.getRootFolders(),
      ]);
      result.sonarr = {
        profiles: profiles.map((p) => ({ id: p.id, name: p.name })),
        rootFolders: rootFolders.map((f) => ({ id: f.id, path: f.path })),
      };
    } catch {}
  }

  if (!mediaType || mediaType === "MOVIE") {
    try {
      const [profiles, rootFolders] = await Promise.all([
        radarr.getQualityProfiles(),
        radarr.getRootFolders(),
      ]);
      result.radarr = {
        profiles: profiles.map((p) => ({ id: p.id, name: p.name })),
        rootFolders: rootFolders.map((f) => ({ id: f.id, path: f.path })),
      };
    } catch {}
  }

  return NextResponse.json(result);
};
