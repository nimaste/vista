import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { PageHeader } from "@/components/page-header";
import { BackupClient } from "./backup-client";

export default async function BackupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/settings/tokens");

  return (
    <>
      <PageHeader
        title="Database Backup"
        description="Create, download, and restore SQLite database backups. Automatic daily backups run at 2 AM and retain the last 7 copies."
      />
      <BackupClient />
    </>
  );
}
