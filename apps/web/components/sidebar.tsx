"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import {
  Bell,
  DatabaseBackup,
  Key,
  Link as LinkIcon,
  LogOut,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";

// Vista's web UI is admin-only now -- browsing/requesting/downloads all live
// in the native iOS/tvOS/Android/Android TV apps, which talk to this same
// backend. The web app's only job is connection/account/backup admin.
type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ADMIN_NAV: NavItem[] = [
  { href: "/settings/connections", label: "Connections", icon: LinkIcon },
  { href: "/settings/users", label: "Users", icon: Users },
  { href: "/settings/tokens", label: "Devices", icon: Key },
  { href: "/settings/backup", label: "Backup and Restore", icon: DatabaseBackup },
];

// Non-admins can only see/manage their own device sessions -- every other
// page here is admin-only and would just bounce them right back.
const USER_NAV: NavItem[] = [
  { href: "/settings/tokens", label: "Devices", icon: Key },
];

type CurrentUser = {
  id: string;
  email: string;
  username: string;
  role: "ADMIN" | "USER";
};

export const Sidebar = ({ user }: { user: CurrentUser }) => {
  const pathname = usePathname();
  const router = useRouter();
  const homeHref = user.role === "ADMIN" ? "/settings/connections" : "/settings/tokens";
  const nav = user.role === "ADMIN" ? ADMIN_NAV : USER_NAV;
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; read: boolean; link: string | null; createdAt: string }[]>([]);

  const loadNotifs = useCallback(async () => {
    try {
      const data = await apiClient<{ notifications: typeof notifications; unreadCount: number }>("/notifications");
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {}
  }, []);

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 30_000);
    return () => clearInterval(interval);
  }, [loadNotifs]);

  const markAllRead = async () => {
    await apiClient("/notifications", { method: "PATCH", body: JSON.stringify({ action: "markAllRead" }) }).catch(() => {});
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = async () => {
    await apiClient("/notifications", { method: "DELETE" }).catch(() => {});
    setUnreadCount(0);
    setNotifications([]);
  };

  const notifRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifs]);

  const onLogout = async () => {
    try {
      await apiClient("/auth/logout", { method: "POST" });
    } catch {
      // best-effort
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside className="hidden w-60 fixed inset-y-0 left-0 z-30 md:flex md:flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href={homeHref} aria-label="Vista home">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.username}</div>
            <div className="text-[11px] uppercase tracking-wide text-sidebar-muted">{user.role}</div>
          </div>
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => { setShowNotifs((v) => !v); if (!showNotifs) loadNotifs(); }}
              title="Notifications"
              aria-label="Notifications"
              className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>

            {showNotifs ? (
              <div className="absolute bottom-full left-0 mb-2 w-72 max-h-80 rounded-lg border border-sidebar-border bg-sidebar shadow-lg">
                <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2">
                  <span className="text-xs font-semibold">Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-[10px] text-sidebar-muted hover:text-sidebar-foreground"
                      >
                        Mark all read
                      </button>
                    ) : null}
                    {notifications.length > 0 ? (
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Clear all
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-sidebar-muted">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.link ?? homeHref}
                        onClick={() => setShowNotifs(false)}
                        className={cn(
                          "block border-b border-sidebar-border/50 px-3 py-2 text-xs transition-colors hover:bg-sidebar-accent/40 last:border-0",
                          !n.read && "bg-sidebar-accent/20",
                        )}
                      >
                        <div className="font-medium">{n.title}</div>
                        <div className="mt-0.5 text-sidebar-muted">{n.message}</div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
