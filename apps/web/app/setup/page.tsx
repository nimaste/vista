import { redirect } from "next/navigation";
import { getAuthStatus } from "@/lib/server/auth";
import { SetupForm } from "./setup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default async function SetupPage() {
  const status = await getAuthStatus();
  if (!status.firstRun) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <Logo size={72} showText={false} className="mb-3" />
          <CardTitle className="text-2xl">Welcome to Vista</CardTitle>
          <CardDescription>Create the admin account to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm />
        </CardContent>
      </Card>
    </main>
  );
}
