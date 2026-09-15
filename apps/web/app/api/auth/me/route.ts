import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";

export const GET = async () => {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ user });
};
