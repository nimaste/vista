import { NextResponse } from "next/server";
import { requireAdminForRoute } from "@/lib/server/auth";
import { listConnectionsRedacted } from "@/lib/server/connections";

export const dynamic = "force-dynamic";

export const GET = async () => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const connections = await listConnectionsRedacted();
  return NextResponse.json({ connections });
};
