import { NextResponse } from "next/server";
import { getConnection } from "@/lib/server/connections";

type ServiceConfig = { url: string; apiKey: string };

const validServices = new Set(["sonarr", "radarr"]);
const validCoverTypes = new Set(["poster", "fanart"]);

const getServiceConfig = async (service: string): Promise<ServiceConfig | null> => {
  const conn = await getConnection(service.toUpperCase() as "SONARR" | "RADARR");
  if (!conn || !conn.apiKey) return null;
  return { url: conn.baseUrl.replace(/\/+$/, ""), apiKey: conn.apiKey };
};

export const GET = async (
  _req: Request,
  { params }: { params: Promise<{ service: string; id: string; coverType: string }> },
) => {
  const { service, id, coverType } = await params;

  if (!validServices.has(service)) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 });
  }
  if (!validCoverTypes.has(coverType)) {
    return NextResponse.json({ error: "Invalid cover type" }, { status: 400 });
  }
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const cfg = await getServiceConfig(service);
  if (!cfg) {
    return NextResponse.json({ error: `${service} not configured` }, { status: 503 });
  }

  const imageUrl = `${cfg.url}/api/v3/MediaCover/${numericId}/${coverType}.jpg?apikey=${cfg.apiKey}`;

  try {
    const upstream = await fetch(imageUrl);
    if (!upstream.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
};
