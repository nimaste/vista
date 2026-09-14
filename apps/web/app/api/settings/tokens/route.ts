import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Tokens are self-provisioned by native clients via /auth/device-login (plain
// username/password login, one token per device) -- there's no manual
// "create a token" flow to pair a device anymore. This route is view + revoke
// only, letting you see which devices are signed in and kick one off.

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
