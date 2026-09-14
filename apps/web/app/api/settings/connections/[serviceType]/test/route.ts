import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForRoute } from "@/lib/server/auth";
import { getConnection, recordTestResult, type ServiceType } from "@/lib/server/connections";
import { sonarr } from "@/lib/server/sonarr";
import { radarr } from "@/lib/server/radarr";
import { overseerr } from "@/lib/server/overseerr";
import { nzbget } from "@/lib/server/nzbget";
import { sabnzbd } from "@/lib/server/sabnzbd";

export const dynamic = "force-dynamic";

const VALID_TYPES: ServiceType[] = ["SONARR", "RADARR", "OVERSEERR", "NZBGET", "SABNZBD"];
const isValid = (v: string): v is ServiceType => (VALID_TYPES as string[]).includes(v);

type Override = { baseUrl?: string; apiKey?: string; username?: string; password?: string };

// Tests ad-hoc, not-yet-saved credentials directly -- lets the Settings UI
// show "Connected" before the admin hits Save, same nicety the old
// per-service test routes had.
const testAdhoc = async (serviceType: ServiceType, o: Override): Promise<{ ok: boolean; message: string }> => {
  const base = (o.baseUrl ?? "").replace(/\/+$/, "");
  try {
    if (serviceType === "SONARR" || serviceType === "RADARR") {
      const res = await fetch(`${base}/api/v3/system/status`, {
        headers: { "X-Api-Key": o.apiKey ?? "" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const data = (await res.json()) as { version: string };
      return { ok: true, message: `${serviceType === "SONARR" ? "Sonarr" : "Radarr"} v${data.version}` };
    }
    if (serviceType === "OVERSEERR") {
      const res = await fetch(`${base}/api/v1/status`, {
        headers: { "X-Api-Key": o.apiKey ?? "" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const data = (await res.json()) as { version: string };
      return { ok: true, message: `Overseerr/Jellyseerr v${data.version}` };
    }
    if (serviceType === "NZBGET") {
      const auth = Buffer.from(`${o.username ?? ""}:${o.password ?? ""}`).toString("base64");
      const res = await fetch(`${base}/jsonrpc`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ method: "version", params: [], id: 1 }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const json = (await res.json()) as { result?: string; error?: { message: string } };
      if (json.error) return { ok: false, message: json.error.message };
      return { ok: true, message: `NZBGet v${json.result}` };
    }
    // SABNZBD
    const params = new URLSearchParams({ mode: "version", apikey: o.apiKey ?? "", output: "json" });
    const res = await fetch(`${base}/api?${params}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const data = (await res.json()) as { version: string };
    return { ok: true, message: `SABnzbd v${data.version}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
  }
};

const testSaved = async (serviceType: ServiceType) => {
  switch (serviceType) {
    case "SONARR": return sonarr.testConnection();
    case "RADARR": return radarr.testConnection();
    case "OVERSEERR": return overseerr.testConnection();
    case "NZBGET": return nzbget.testConnection();
    case "SABNZBD": return sabnzbd.testConnection();
  }
};

export const POST = async (req: NextRequest, ctx: { params: { serviceType: string } }) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serviceType = ctx.params.serviceType.toUpperCase();
  if (!isValid(serviceType)) return NextResponse.json({ error: "Invalid service type" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Override;
  const hasOverrideCreds = serviceType === "NZBGET" ? !!(body.username && body.password) : !!body.apiKey;

  let result: { ok: boolean; message: string };
  if (body.baseUrl && hasOverrideCreds) {
    result = await testAdhoc(serviceType, body);
  } else if (body.baseUrl) {
    // URL changed but creds weren't retyped -- reuse the saved secret against the new URL.
    const saved = await getConnection(serviceType);
    if (!saved) return NextResponse.json({ ok: false, message: "Not configured yet" }, { status: 400 });
    result = await testAdhoc(serviceType, { baseUrl: body.baseUrl, apiKey: saved.apiKey ?? undefined, username: saved.username ?? undefined, password: saved.password ?? undefined });
  } else {
    result = await testSaved(serviceType);
  }

  await recordTestResult(serviceType, result.ok);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
};
