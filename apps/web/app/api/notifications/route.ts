import { NextResponse, type NextRequest } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export const GET = async () => {
  const user = await requireUserForRoute();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });

  return NextResponse.json({ notifications, unreadCount });
};

export const PATCH = async (req: NextRequest) => {
  const user = await requireUserForRoute();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; ids?: string[] };

  if (body.action === "markAllRead") {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "markRead" && Array.isArray(body.ids)) {
    await prisma.notification.updateMany({
      where: { id: { in: body.ids }, userId: user.id },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
};

export const DELETE = async () => {
  const user = await requireUserForRoute();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
};
