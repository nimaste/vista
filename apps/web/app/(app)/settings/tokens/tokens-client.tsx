"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Key, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient, ApiError } from "@/lib/api-client";

type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export const TokensClient = ({ initial }: { initial: TokenRow[] }) => {
  const router = useRouter();
  const [tokens, setTokens] = useState(initial);

  const refresh = async () => {
    const data = await apiClient<{ tokens: TokenRow[] }>("/settings/tokens");
    setTokens(data.tokens);
    router.refresh();
  };

  const remove = async (t: TokenRow) => {
    if (!confirm(`Sign out "${t.name}"? That device will need to log in again.`)) return;
    try {
      await apiClient(`/settings/tokens/${t.id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Sign-out failed");
    }
  };

  return (
    <div className="grid gap-6">
      <div>
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Each time you sign in on iOS, tvOS, Android, or Android TV, that
            device shows up here. Sign one out remotely if you lose the
            device or don&apos;t recognize it — it&apos;ll need to log in
            again to reconnect.
          </CardContent>
        </Card>
      </div>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No signed-in devices yet.</p>
      ) : (
        <div className="grid gap-3">
          {tokens.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-base font-medium">{t.name}</span>
                    {t.expiresAt && new Date(t.expiresAt) < new Date() ? (
                      <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-[11px] text-destructive">
                        expired
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {t.prefix}…
                    <span className="ml-3">
                      {t.lastUsedAt ? `Last used ${new Date(t.lastUsedAt).toLocaleString()}` : "Never used"}
                    </span>
                    {t.expiresAt ? (
                      <span className="ml-3">Expires {new Date(t.expiresAt).toLocaleDateString()}</span>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(t)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
