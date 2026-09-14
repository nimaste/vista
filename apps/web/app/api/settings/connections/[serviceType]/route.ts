import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminForRoute } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { upsertConnection, type ServiceType } from "@/lib/server/connections";

export const dynamic = "force-dynamic";

const VALID_TYPES: ServiceType[] = ["SONARR", "RADARR", "OVERSEERR", "NZBGET", "SABNZBD"];

const isValid = (v: string): v is ServiceType => (VALID_TYPES as string[]).includes(v);

const bodySchema = z.object({
  name: z.string().optional().nullable(),
  baseUrl: z.string().url("Must be a valid URL"),
  apiKey: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

export const PUT = async (req: NextRequest, ctx: { params: { serviceType: string } }) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serviceType = ctx.params.serviceType.toUpperCase();
  if (!isValid(serviceType)) return NextResponse.json({ error: "Invalid service type" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });

  if (serviceType === "NZBGET" && (!parsed.data.username || !parsed.data.password))
    return NextResponse.json({ error: "NZBGet requires username and password" }, { status: 400 });
  if (serviceType !== "NZBGET" && !parsed.data.apiKey)
    return NextResponse.json({ error: "An API key is required" }, { status: 400 });

  await upsertConnection(serviceType, parsed.data);
  return NextResponse.json({ ok: true });
};

export const DELETE = async (_req: Request, ctx: { params: { serviceType: string } }) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const serviceType = ctx.params.serviceType.toUpperCase();
  if (!isValid(serviceType)) return NextResponse.json({ error: "Invalid service type" }, { status: 400 });
  await prisma.serverConnection.deleteMany({ where: { serviceType } });
  return NextResponse.json({ ok: true });
};
