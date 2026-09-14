import { requireUser } from "@/lib/server/auth";
import { Sidebar } from "@/components/sidebar";
import packageJson from "../../package.json";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} version={packageJson.version} />
      <main className="md:ml-60 min-h-screen p-6">{children}</main>
    </div>
  );
}
