import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUserForRoute } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { displayPrefix, generateRawToken, hashToken } from "@/lib/server/tokens";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(64),
  expiresInDays: z.number().int().min(1).max(3650).optional().nullable(),
});

export const GET = async () => {
  const user = await requireUserForRoute();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ tokens });
};

export const POST = async (req: NextRequest) => {
  const user = await requireUserForRoute();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ValidationError" }, { status: 400 });

  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const prefix = displayPrefix(raw);
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const token = await prisma.apiToken.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      tokenHash,
      prefix,
      expiresAt,
    },
    select: { id: true, name: true, prefix: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json({ token, rawToken: raw }, { status: 201 });
};
