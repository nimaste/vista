import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import { requireAdminForRoute } from "@/lib/server/auth";
import { getBackupPath, deleteBackup } from "@/lib/server/backup";

export const dynamic = "force-dynamic";

type Ctx = { params: { filename: string } };

/** Download a specific backup file. */
export const GET = async (_req: NextRequest, { params }: Ctx) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const fullPath = await getBackupPath(params.filename);
    const stat = fs.statSync(fullPath);
    const stream = fs.createReadStream(fullPath);

    // Convert Node readable stream to a web ReadableStream.
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk as Uint8Array));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${params.filename}"`,
        "Content-Length": String(stat.size),
      },
    });
  } catch {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }
};

/** Delete a specific backup. */
export const DELETE = async (_req: NextRequest, { params }: Ctx) => {
  if (!(await requireAdminForRoute()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await deleteBackup(params.filename);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }
};
