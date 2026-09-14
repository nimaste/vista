import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { PageHeader } from "@/components/page-header";
import { TokensClient } from "./tokens-client";

export default async function TokensPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [tokens, tmdbRow] = await Promise.all([
    prisma.apiToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, prefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    }),
    prisma.setting.findUnique({ where: { key: "tmdbApiKey" } }),
  ]);

  const tmdbKey = tmdbRow ? (JSON.parse(tmdbRow.value) as string) : "";
  const tmdbKeyMasked = tmdbKey ? `${tmdbKey.slice(0, 6)}…${tmdbKey.slice(-4)}` : "";

  return (
    <>
      <PageHeader
        title="API Tokens"
        description="Bearer tokens for Vista's mobile and TV apps. Treat these like passwords."
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
        tmdbKeyMasked={tmdbKeyMasked}
        hasTmdbKey={!!tmdbKey}
      />
    </>
  );
}
