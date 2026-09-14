import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminForRoute } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

export const dynamic = "force-dynamic";

export const GET = async () => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
};

const createSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(50),
  password: z.string().min(8).max(200),
  role: z.enum(["ADMIN", "USER"]).optional(),
});

export const POST = async (req: NextRequest) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "ValidationError", details: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: parsed.data.email }, { username: parsed.data.username }] },
  });
  if (existing)
    return NextResponse.json({ error: "Email or username already taken" }, { status: 409 });

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      username: parsed.data.username,
      passwordHash,
      role: parsed.data.role ?? "USER",
    },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
};
