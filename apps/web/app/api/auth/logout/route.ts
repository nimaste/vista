import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/auth";

export const POST = async () => {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
};
