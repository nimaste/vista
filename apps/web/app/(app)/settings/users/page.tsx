import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { PageHeader } from "@/components/page-header";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage user accounts and permissions."
      />
      <UsersClient currentUserId={user.id} />
    </div>
  );
}
