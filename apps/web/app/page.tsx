import { redirect } from "next/navigation";
import { getAuthStatus, getCurrentUser } from "@/lib/server/auth";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect("/settings/connections");

  const status = await getAuthStatus();
  if (status.firstRun) redirect("/setup");
  redirect("/login");
}
