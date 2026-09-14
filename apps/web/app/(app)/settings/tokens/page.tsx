import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { PageHeader } from "@/components/page-header";
import { TokensClient } from "./tokens-client";

export default async function TokensPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
  });

  return (
    <>
      <PageHeader
        title="Devices"
        description="Devices signed in to your account."
      />
      <TokensClient
        initial={tokens.map((t) => ({
          id: t.id,
          name: t.name,
          prefix: t.prefix,
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          expiresAt: t.expiresAt?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
