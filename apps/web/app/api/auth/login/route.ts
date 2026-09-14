import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { setSessionCookie, signSession } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const POST = async (req: NextRequest) => {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const { ok } = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!ok) {
    return NextResponse.json(
      { error: "TooManyRequests", message: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", message: "Invalid input" },
      { status: 400 },
    );
  }

  const id = parsed.data.identifier.trim();
  const isEmail = id.includes("@");
  const user = await prisma.user.findFirst({
    where: isEmail ? { email: id.toLowerCase() } : { username: id },
  });

  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Invalid credentials" },
      { status: 401 },
    );
  }

  const token = await signSession(user.id);
  setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
  });
};
