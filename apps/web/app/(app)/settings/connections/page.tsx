import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { PageHeader } from "@/components/page-header";
import { ConnectionsClient } from "./connections-client";

export default async function ConnectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/login");

  return (
    <>
      <PageHeader
        title="Connections"
        description="Connect Sonarr, Radarr, Overseerr/Jellyseerr, NZBGet, and SABnzbd."
      />
      <ConnectionsClient />
    </>
  );
}
