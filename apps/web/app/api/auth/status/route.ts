import { NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const GET = async () => {
  const status = await getAuthStatus();
  return NextResponse.json(status);
};
