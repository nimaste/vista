import { NextResponse } from "next/server";
import { LRUCache } from "lru-cache";
import { getConnection } from "@/lib/server/connections";

type ServiceConfig = { url: string; apiKey: string };

const validServices = new Set(["sonarr", "radarr"]);
const validCoverTypes = new Set(["poster", "fanart"]);

// Sonarr/Radarr posters get requested on every Library grid render -- every
// item, every time. Cache the actual image bytes here (not just metadata) so
// repeat loads skip the Sonarr/Radarr round-trip entirely instead of only
// benefiting from the client's own HTTP cache on a cold app launch.
type CachedImage = { data: Buffer; contentType: string };
const imageCache = new LRUCache<string, CachedImage>({
  max: 300,
  ttl: 1000 * 60 * 60, // 1 hour -- posters change rarely, this just bounds staleness
});

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

  const cacheKey = `${service}:${numericId}:${coverType}`;
  const cached = imageCache.get(cacheKey);
  if (cached) {
    return new NextResponse(new Uint8Array(cached.data), {
      status: 200,
      headers: { "Content-Type": cached.contentType, "Cache-Control": "public, max-age=86400" },
    });
  }

  const cfg = await getServiceConfig(service);
  if (!cfg) {
    return NextResponse.json({ error: `${service} not configured` }, { status: 503 });
  }

  const imageUrl = `${cfg.url}/api/v3/MediaCover/${numericId}/${coverType}.jpg?apikey=${cfg.apiKey}`;

  try {
    const upstream = await fetch(imageUrl);
    if (!upstream.ok || !upstream.body) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";

    // Stream straight through to the client (first-load latency matters --
    // buffering the whole image before responding, as an earlier version of
    // this route did, made every never-before-seen poster slower, not
    // faster). Tee the same bytes into the cache in the background so the
    // *next* request for this image skips Sonarr/Radarr entirely.
    const [clientStream, cacheStream] = upstream.body.tee();
    new Response(cacheStream).arrayBuffer()
      .then((buf) => imageCache.set(cacheKey, { data: Buffer.from(buf), contentType }))
      .catch(() => {});

    return new NextResponse(clientStream, {
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
