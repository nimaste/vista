import { NextResponse } from "next/server";
import { requireUserForRoute } from "@/lib/server/auth";
import { STUDIOS } from "@/lib/server/overseerr";

export const dynamic = "force-dynamic";

export const GET = async () => {
  if (!(await requireUserForRoute())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ studios: STUDIOS });
};
