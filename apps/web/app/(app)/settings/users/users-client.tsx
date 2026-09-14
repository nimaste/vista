"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Plus,
  Shield,
  Trash2,
  User as UserIcon,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from "@/lib/api-client";

type UserRow = {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
};

export const UsersClient = ({ currentUserId }: { currentUserId: string }) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add form
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("USER");

  // Edit form
  const [editRole, setEditRole] = useState("USER");
  const [editPassword, setEditPassword] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiClient<{ users: UserRow[] }>("/settings/users");
      setUsers(data.users);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addUser = async () => {
    if (!newEmail || !newUsername || !newPassword) return;
    setSaving(true);
    try {
      await apiClient("/settings/users", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail,
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });
      setShowAdd(false);
      setNewEmail("");
      setNewUsername("");
      setNewPassword("");
      setNewRole("USER");
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    setEditRole(u.role);
    setEditPassword("");
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { role: editRole };
      if (editPassword) body.password = editPassword;
      await apiClient(`/settings/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: string, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await apiClient(`/settings/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed");
    }
  };

  const inputCls = "h-9 rounded-md border border-input bg-background px-3 text-sm";
  const selectCls = "h-9 rounded-md border border-input bg-background px-3 text-sm";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {users.map((u) => {
        const isEditing = editingId === u.id;
        const isSelf = u.id === currentUserId;
        return (
          <div key={u.id} className="rounded-lg border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {u.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{u.username}</span>
                  {u.role === "ADMIN" ? (
                    <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                      <Shield className="h-2.5 w-2.5" /> Admin
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <UserIcon className="h-2.5 w-2.5" /> User
                    </span>
                  )}
                  {isSelf ? (
                    <span className="text-[10px] text-muted-foreground">(you)</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              {!isSelf ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => (isEditing ? setEditingId(null) : startEdit(u))}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteUser(u.id, u.username)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>

            {isEditing ? (
              <div className="mt-3 border-t pt-3">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="grid gap-1.5">
                    <Label>Role</Label>
                    <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className={selectCls}>
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>New password</Label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className={inputCls}
                      placeholder="Leave blank to keep"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(u.id)} disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {showAdd ? (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-semibold">Create user</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} placeholder="user@example.com" />
            </div>
            <div className="grid gap-1.5">
              <Label>Username</Label>
              <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className={inputCls} placeholder="username" />
            </div>
            <div className="grid gap-1.5">
              <Label>Password</Label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="min 8 characters" />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={selectCls}>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={addUser} disabled={saving || !newEmail || !newUsername || !newPassword} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)} className="gap-2 border-dashed border-blue-500/40 text-blue-600 hover:bg-blue-500/5 hover:border-blue-500/60">
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      )}
    </div>
  );
};
