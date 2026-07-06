"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { isLegacyMode, setLegacySession } from "@/lib/clientSession";
import { Button, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // TEMPORARY pre-launch mode: check credentials against the old Firestore docs.
    if (isLegacyMode) {
      try {
        const res = await fetch("/api/legacy-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const text = await res.text();
        let data: {
          error?: string;
          token?: string;
          profile?: { role: "admin" | "client"; clientId: string | null; email: string; displayName: string };
        };
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            res.status === 404
              ? "The legacy login endpoint is missing — the deployed build is out of date. Redeploy the latest code."
              : `Server returned an unexpected response (${res.status}).`
          );
        }
        if (!res.ok || !data.token || !data.profile) {
          throw new Error(data.error ?? "Could not log in.");
        }
        setLegacySession({ token: data.token, profile: data.profile });
        // Full reload so AuthProvider picks up the new session.
        window.location.href = data.profile.role === "admin" ? "/admin" : "/portal";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not log in.");
        setBusy(false);
      }
      return;
    }

    try {
      await signInWithEmailAndPassword(firebaseAuth(), email, password);
      router.replace("/");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      const messages: Record<string, string> = {
        "auth/user-not-found": "No account exists with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/too-many-requests": "Too many attempts — wait a few minutes and try again.",
        "auth/operation-not-allowed":
          "Email/password sign-in is not enabled in Firebase (console → Authentication → Sign-in method).",
        "auth/network-request-failed": "Network error — check your connection and try again.",
      };
      setError(messages[code] ?? `Could not log in (${code || "unknown error"}).`);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900">Log in</h1>
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          New client?{" "}
          <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
