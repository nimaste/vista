"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, HardDriveUpload, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient, ApiError } from "@/lib/api-client";

type BackupInfo = {
  filename: string;
  size: number;
  createdAt: string;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleString();
};

export const BackupClient = () => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient<{ backups: BackupInfo[] }>("/settings/backup");
      setBackups(data.backups);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load backups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const createBackup = async () => {
    setCreating(true);
    setError(null);
    try {
      await apiClient("/settings/backup", { method: "POST" });
      showSuccess("Backup created successfully");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Backup failed");
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = (filename: string) => {
    // Trigger a browser download via a hidden link.
    const a = document.createElement("a");
    a.href = `/api/settings/backup/${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const deleteBackup = async (filename: string) => {
    if (!confirm(`Delete backup "${filename}"?`)) return;
    setError(null);
    try {
      await apiClient(`/settings/backup/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      showSuccess("Backup deleted");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  };

  const handleRestore = async (file: File) => {
    setRestoring(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/settings/backup/restore", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || body?.error || "Restore failed");
      }
      setRestoreOpen(false);
      showSuccess("Database restored successfully. You may need to refresh the page.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          <p>
            Backups are stored alongside the database in <code className="mx-1 rounded bg-muted px-1 py-0.5">/config/backups/</code>.
            A daily automatic backup runs at 2:00 AM and retains the last 7 copies.
          </p>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-500">
          {success}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setRestoreOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" /> Restore from file
        </Button>
        <Button onClick={createBackup} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {creating ? "Creating..." : "Create Backup"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading backups...
        </div>
      ) : backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No backups yet. Create one manually or wait for the daily automatic backup.</p>
      ) : (
        <div className="grid gap-3">
          {backups.map((b) => (
            <Card key={b.filename}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <HardDriveUpload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-base font-medium font-mono">{b.filename}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDate(b.createdAt)}
                    <span className="ml-3">{formatSize(b.size)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadBackup(b.filename)}
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteBackup(b.filename)}
                    className="text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RestoreDialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onRestore={handleRestore}
        restoring={restoring}
      />
    </div>
  );
};

const RestoreDialog = ({
  open,
  onClose,
  onRestore,
  restoring,
}: {
  open: boolean;
  onClose: () => void;
  onRestore: (file: File) => void;
  restoring: boolean;
}) => {
  const [file, setFile] = useState<File | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setFile(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore Database</DialogTitle>
          <DialogDescription>
            This will replace the current database with the uploaded file. This action is destructive
            and cannot be undone. Make sure you have a current backup before proceeding.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label
            htmlFor="restore-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/30 p-6 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50"
          >
            <Upload className="h-6 w-6" />
            {file ? (
              <span className="font-medium text-foreground">{file.name}</span>
            ) : (
              <span>Click to select a .db backup file</span>
            )}
            <input
              id="restore-file"
              type="file"
              accept=".db"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={restoring}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => file && onRestore(file)}
            disabled={!file || restoring}
            className="gap-2"
          >
            {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {restoring ? "Restoring..." : "Restore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
