"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Spinner } from "@/components/ui";

export default function Home() {
  const { user, role, roleError, loading, logout, refresh } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && role === "admin") router.replace("/admin");
    else if (user && role === "client") router.replace("/portal");
  }, [user, role, loading, router]);

  if (loading) return <Spinner />;

  // Signed in but no role — surface why instead of spinning forever.
  if (user && !role) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-8">
          <h1 className="text-lg font-semibold text-amber-900">
            Your account isn’t fully set up yet
          </h1>
          <p className="mt-3 text-sm text-amber-800">
            You’re logged in as <span className="font-medium">{user.email}</span>, but no
            role (admin or client) is assigned to this account.
          </p>
          {roleError && (
            <p className="mt-3 rounded-lg bg-amber-100 p-3 font-mono text-xs text-amber-900">
              {roleError}
            </p>
          )}
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-800">
            <li>
              Agency team member? Your email must be listed in the ADMIN_EMAILS environment
              variable (exact match), and FIREBASE_SERVICE_ACCOUNT_KEY must be set —
              then log out and back in.
            </li>
            <li>
              Client? Your account may not be migrated yet — contact your Own It Social
              team.
            </li>
          </ul>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" onClick={() => refresh()}>
              Try again
            </Button>
            <Button variant="ghost" onClick={() => logout()}>
              Log out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (user) return <Spinner />;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Own It Social
        </h1>
        <p className="mt-2 text-sm text-gray-500">Client Portal</p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Create your client account
          </Link>
        </div>
      </div>
    </main>
  );
}
