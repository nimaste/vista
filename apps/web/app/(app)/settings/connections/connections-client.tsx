"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type ServiceType = "SONARR" | "RADARR" | "OVERSEERR" | "NZBGET" | "SABNZBD";

type ConnectionSummary = {
  serviceType: ServiceType;
  baseUrl: string;
  hasApiKey: boolean;
  hasPassword: boolean;
  username: string | null;
  enabled: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
};

type TestResult = { ok: boolean; message: string } | null;

const usesUsernamePassword = (serviceType: ServiceType) => serviceType === "NZBGET";

const ConnectionCard = ({
  serviceType,
  title,
  description,
  urlPlaceholder,
  summary,
  onSaved,
}: {
  serviceType: ServiceType;
  title: string;
  description: string;
  urlPlaceholder: string;
  summary: ConnectionSummary | undefined;
  onSaved: () => void;
}) => {
  const [baseUrl, setBaseUrl] = useState(summary?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState(summary?.username ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    setBaseUrl(summary?.baseUrl ?? "");
    setUsername(summary?.username ?? "");
  }, [summary?.baseUrl, summary?.username]);

  const usesUserPass = usesUsernamePassword(serviceType);
  const hasCreds = usesUserPass ? summary?.hasPassword : summary?.hasApiKey;

  const onSave = async () => {
    setSaving(true);
    setSaveMsg("");
    setTestResult(null);
    try {
      const body: Record<string, unknown> = { baseUrl };
      if (usesUserPass) {
        if (username) body.username = username;
        if (password) body.password = password;
      } else if (apiKey) {
        body.apiKey = apiKey;
      }
      await apiClient(`/settings/connections/${serviceType.toLowerCase()}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setSaveMsg("Saved");
      setApiKey("");
      setPassword("");
      onSaved();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body: Record<string, string> = {};
      if (baseUrl) body.baseUrl = baseUrl;
      if (usesUserPass) {
        if (username) body.username = username;
        if (password) body.password = password;
      } else if (apiKey) {
        body.apiKey = apiKey;
      }
      const result = await apiClient<{ ok: boolean; message: string }>(
        `/settings/connections/${serviceType.toLowerCase()}/test`,
        { method: "POST", body: JSON.stringify(body) },
      );
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const canTest = !!baseUrl && (usesUserPass ? !!(username && password) || hasCreds : !!apiKey || hasCreds);
  const canSave = !!baseUrl && (usesUserPass ? (!!(username && password) || hasCreds) : (!!apiKey || hasCreds));

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {summary?.lastTestOk !== null && summary?.lastTestOk !== undefined ? (
          <span className={`text-xs font-medium ${summary.lastTestOk ? "text-green-500" : "text-red-500"}`}>
            {summary.lastTestOk ? "Connected" : "Not connected"}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-medium" htmlFor={`${serviceType}-url`}>URL</label>
          <input
            id={`${serviceType}-url`}
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={urlPlaceholder}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {usesUserPass ? (
          <>
            <div>
              <label className="text-sm font-medium" htmlFor={`${serviceType}-user`}>Username</label>
              <input
                id={`${serviceType}-user`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor={`${serviceType}-pass`}>Password</label>
              <input
                id={`${serviceType}-pass`}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasCreds ? "••••••••" : "Enter password"}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="text-sm font-medium" htmlFor={`${serviceType}-key`}>API Key</label>
            <input
              id={`${serviceType}-key`}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasCreds ? "••••••••" : "Enter API key"}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onTest}
          disabled={testing || !canTest}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-50"
        >
          {testing ? "Testing…" : "Test Connection"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !canSave}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {testResult ? (
          <span className={`text-sm ${testResult.ok ? "text-green-500" : "text-red-500"}`}>
            {testResult.message}
          </span>
        ) : null}
        {saveMsg ? <span className="text-sm text-green-500">{saveMsg}</span> : null}
      </div>
    </div>
  );
};

const SERVICES: { serviceType: ServiceType; title: string; description: string; urlPlaceholder: string }[] = [
  { serviceType: "SONARR", title: "Sonarr", description: "TV show library, add/delete, and interactive search.", urlPlaceholder: "http://10.1.1.2:8989" },
  { serviceType: "RADARR", title: "Radarr", description: "Movie library, add/delete, and interactive search.", urlPlaceholder: "http://10.1.1.2:7878" },
  { serviceType: "OVERSEERR", title: "Overseerr / Jellyseerr", description: "Discover and request titles -- requests are submitted here and Overseerr hands them off to Sonarr/Radarr itself.", urlPlaceholder: "http://10.1.1.2:5055" },
  { serviceType: "NZBGET", title: "NZBGet", description: "Usenet download queue and history.", urlPlaceholder: "http://10.1.1.2:6789" },
  { serviceType: "SABNZBD", title: "SABnzbd", description: "Usenet download queue and history.", urlPlaceholder: "http://10.1.1.2:8080" },
];

export const ConnectionsClient = () => {
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await apiClient<{ connections: ConnectionSummary[] }>("/settings/connections");
      setConnections(data.connections);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 max-w-2xl">
      {SERVICES.map((s) => (
        <ConnectionCard
          key={s.serviceType}
          serviceType={s.serviceType}
          title={s.title}
          description={s.description}
          urlPlaceholder={s.urlPlaceholder}
          summary={connections.find((c) => c.serviceType === s.serviceType)}
          onSaved={load}
        />
      ))}
    </div>
  );
};
