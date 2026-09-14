import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export const DELETE = async (_req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUserForRoute();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Scope to the calling user — can't delete someone else's tokens.
  await prisma.apiToken.deleteMany({ where: { id: ctx.params.id, userId: user.id } });
  return new NextResponse(null, { status: 204 });
};
