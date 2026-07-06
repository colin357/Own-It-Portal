"use client";

import { useState } from "react";
import { getAuthToken } from "@/lib/clientSession";
import { Button } from "@/components/ui";

interface Result {
  mode: string;
  stats: Record<string, number>;
  logs: string[];
  error?: string;
}

export default function MigratePage() {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(commit: boolean) {
    if (
      commit &&
      !confirm(
        "Run the migration for real? This creates logins, clients, tasks, and content from the old portal data (re-running is safe — it updates rather than duplicates)."
      )
    )
      return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/migrate${commit ? "?commit=true" : ""}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Migration failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed.");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Legacy Data Migration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Imports the old portal&apos;s data (clients, logins, content, calendar, videos)
          into this portal. Old data is never modified, except plaintext passwords are
          removed once proper logins exist. Safe to re-run.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => run(false)} disabled={busy}>
          {busy ? "Running…" : "1. Dry run (preview only)"}
        </Button>
        <Button onClick={() => run(true)} disabled={busy}>
          {busy ? "Running…" : "2. Migrate for real"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">
              Summary ({result.mode === "commit" ? "MIGRATED" : "dry run — nothing written"})
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-1 text-sm text-gray-600 sm:grid-cols-3">
              {Object.entries(result.stats)
                .sort()
                .map(([k, v]) => (
                  <li key={k}>
                    <span className="font-medium text-gray-900">{v}</span> {k}
                  </li>
                ))}
            </ul>
          </div>
          <div className="max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-gray-900 p-4">
            <pre className="whitespace-pre-wrap text-xs text-gray-200">
              {result.logs.join("\n")}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
