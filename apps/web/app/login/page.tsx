import { redirect } from "next/navigation";
import { getAuthStatus, getCurrentUser } from "@/lib/server/auth";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/settings/connections");

  const status = await getAuthStatus();
  if (status.firstRun) redirect("/setup");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo size={64} showText={false} className="mb-3" />
          <CardTitle className="text-2xl">Sign in to Vista</CardTitle>
          <CardDescription>Use your email or username.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
