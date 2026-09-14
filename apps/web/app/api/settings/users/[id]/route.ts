import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminForRoute } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const updateSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(2).max(50).optional(),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
});

export const PATCH = async (req: NextRequest, { params }: Params) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "ValidationError" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.username !== undefined) data.username = parsed.data.username;
  if (parsed.data.password !== undefined) data.passwordHash = await hashPassword(parsed.data.password);
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true, email: true, username: true, role: true, createdAt: true,
    },
  });

  return NextResponse.json({ user });
};

export const DELETE = async (_req: Request, { params }: Params) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (existing.role === "ADMIN" && adminCount <= 1) {
    return NextResponse.json({ error: "Cannot delete the last admin" }, { status: 409 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
};
