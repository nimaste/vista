import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { downloads } from "@/lib/server/downloads";

export const dynamic = "force-dynamic";

export const GET = async () => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await downloads.getQueue();
  return NextResponse.json({ items });
};
