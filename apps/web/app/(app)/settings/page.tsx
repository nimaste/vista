import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/login");
  redirect("/settings/connections");
}
