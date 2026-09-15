import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { getAuthStatus, getCurrentUser, setSessionCookie, signSession } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/, "Invalid characters"),
  password: z.string().min(8).max(200),
});

export const POST = async (req: NextRequest) => {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const { ok } = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!ok) {
    return NextResponse.json(
      { error: "TooManyRequests", message: "Too many registration attempts. Try again later." },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", message: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const status = await getAuthStatus();
  let role: "ADMIN" | "USER" = "ADMIN";

  if (!status.firstRun) {
    const caller = await getCurrentUser();
    if (!caller || caller.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden", message: "Only admins can create accounts" },
        { status: 403 },
      );
    }
    role = "USER";
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: parsed.data.email.toLowerCase() }, { username: parsed.data.username }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Conflict", message: "Email or username already in use" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      username: parsed.data.username,
      passwordHash,
      role,
    },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });

  // Auto-sign-in only for the first (admin) account so the installer flow is seamless.
  if (status.firstRun) {
    const token = await signSession(user.id);
    setSessionCookie(token);
  }

  return NextResponse.json({ user }, { status: 201 });
};
