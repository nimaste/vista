import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" ? "/settings/connections" : "/settings/tokens");
}
