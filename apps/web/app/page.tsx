import { redirect } from "next/navigation";
import { getAuthStatus, getCurrentUser } from "@/lib/server/auth";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/settings/connections" : "/settings/tokens");

  const status = await getAuthStatus();
  if (status.firstRun) redirect("/setup");
  redirect("/login");
}
