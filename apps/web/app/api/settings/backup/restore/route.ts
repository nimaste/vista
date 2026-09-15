import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAdminForRoute } from "@/lib/server/auth";
import { getBackupDir, restoreFromBackup } from "@/lib/server/backup";

export const dynamic = "force-dynamic";

/** Upload a .db file and restore the database from it. */
export const POST = async (req: NextRequest) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.name.endsWith(".db")) {
      return NextResponse.json(
        { error: "A .db file is required" },
        { status: 400 },
      );
    }

    // Write the uploaded file to a temp location in the backup dir.
    const dir = getBackupDir();
    await fs.mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `_upload-${Date.now()}.db`);

    const bytes = new Uint8Array(await file.arrayBuffer());
    await fs.writeFile(tempPath, bytes);

    try {
      await restoreFromBackup(tempPath);
    } finally {
      // Clean up the temp upload.
      await fs.unlink(tempPath).catch(() => {});
    }

    return NextResponse.json({ ok: true, message: "Database restored successfully" });
  } catch (err) {
    return NextResponse.json(
      { error: "Restore failed", message: String(err) },
      { status: 500 },
    );
  }
};
