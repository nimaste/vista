import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

type ServiceConfig = { url: string; apiKey: string };

const validServices = new Set(["sonarr", "radarr"]);
const validCoverTypes = new Set(["poster", "fanart"]);

const getServiceConfig = async (service: string): Promise<ServiceConfig | null> => {
  const row = await prisma.setting.findUnique({ where: { key: service } });
  if (!row) return null;
  const val = JSON.parse(row.value) as Partial<ServiceConfig>;
  if (!val.url || !val.apiKey) return null;
  return { url: val.url.replace(/\/+$/, ""), apiKey: val.apiKey };
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
