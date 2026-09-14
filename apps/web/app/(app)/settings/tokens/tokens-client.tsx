"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ token: string; name: string } | null>(null);

  const refresh = async () => {
    const data = await apiClient<{ tokens: TokenRow[] }>("/settings/tokens");
    setTokens(data.tokens);
    router.refresh();
  };

  const remove = async (t: TokenRow) => {
    if (!confirm(`Revoke "${t.name}"? Anything using it will stop working.`)) return;
    try {
      await apiClient(`/settings/tokens/${t.id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Revoke failed");
    }
  };

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="mb-4 text-lg font-semibold">Bearer Tokens</h2>
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            <p>
              Use these tokens in mobile or TV clients. Send the token in the
              <code className="mx-1 rounded bg-muted px-1 py-0.5">Authorization: Bearer &lt;token&gt;</code>
              header. Tokens are shown once at creation time — copy it immediately.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New token
        </Button>
      </div>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens yet.</p>
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

      <CreateDialog open={creating} onClose={() => setCreating(false)} onCreated={(raw, name) => { setRevealed({ token: raw, name }); void refresh(); }} />

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy this token now</DialogTitle>
            <DialogDescription>
              "{revealed?.name}" — this is the only time Vista will show the full token. Paste it into your client, then close this dialog.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
              <code className="flex-1 break-all font-mono text-xs">{revealed?.token}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => revealed && navigator.clipboard.writeText(revealed.token)}
                className="gap-2"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CreateDialog = ({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (rawToken: string, name: string) => void;
}) => {
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (expiresInDays.trim()) body.expiresInDays = Math.max(1, Number(expiresInDays));
      const res = await apiClient<{ rawToken: string }>("/settings/tokens", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onCreated(res.rawToken, name.trim());
      setName("");
      setExpiresInDays("");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API token</DialogTitle>
          <DialogDescription>Give the token a descriptive name so you can revoke it later if needed.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tok-name">Name</Label>
            <Input
              id="tok-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chris's iPhone"
              maxLength={64}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tok-expiry">Expires in (days, optional)</Label>
            <Input
              id="tok-expiry"
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              min={1}
              max={3650}
              placeholder="Leave blank for no expiry"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
