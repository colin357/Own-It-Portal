"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { Spinner } from "@/components/ui";

export default function Home() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && role === "admin") router.replace("/admin");
    else if (user && role === "client") router.replace("/portal");
  }, [user, role, loading, router]);

  if (loading || user) return <Spinner />;

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
