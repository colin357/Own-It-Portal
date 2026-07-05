"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithCustomToken } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { Button, Input, Label } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, displayName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Signup failed.");
      await signInWithCustomToken(firebaseAuth(), data.token);
      router.replace("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900">
          Create your account
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          Welcome to Own It Social — let’s get you set up.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <div>
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Acme Realty"
            />
          </div>
          <div>
            <Label htmlFor="displayName">Your name</Label>
            <Input
              id="displayName"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Creating account…" : "Sign up"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
