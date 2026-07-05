"use client";

import type { ReactNode } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/client";

export function FirebaseGate({ children }: { children: ReactNode }) {
  if (isFirebaseConfigured) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-8">
        <h1 className="text-lg font-semibold text-amber-900">
          Firebase is not configured yet
        </h1>
        <p className="mt-3 text-sm text-amber-800">
          Copy <code className="rounded bg-amber-100 px-1">.env.example</code> to{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code> and fill in your
          Firebase project credentials, then restart the dev server.
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-amber-800">
          <li>Open the Firebase console → Project settings → General → Your apps.</li>
          <li>Copy the web app config values into the NEXT_PUBLIC_FIREBASE_* vars.</li>
          <li>
            Create a service account key (Project settings → Service accounts) and set
            FIREBASE_SERVICE_ACCOUNT_KEY to its base64-encoded JSON.
          </li>
          <li>Set ADMIN_EMAILS to a comma-separated list of your team’s emails.</li>
        </ol>
        <p className="mt-4 text-xs text-amber-700">
          See README.md for the full setup guide, including deploying Firestore and
          Storage security rules.
        </p>
      </div>
    </div>
  );
}
