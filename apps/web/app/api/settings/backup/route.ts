import { NextResponse } from "next/server";
import { requireAdminForRoute } from "@/lib/server/auth";
import { listBackups, performBackup, pruneBackups } from "@/lib/server/backup";

export const dynamic = "force-dynamic";

/** List all backups. */
export const GET = async () => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const backups = await listBackups();
  return NextResponse.json({ backups });
};

/** Trigger a manual backup, then prune to keep 7. */
export const POST = async () => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const backup = await performBackup();
    await pruneBackups(7);
    return NextResponse.json({ backup }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Backup failed", message: String(err) },
      { status: 500 },
    );
  }
};
