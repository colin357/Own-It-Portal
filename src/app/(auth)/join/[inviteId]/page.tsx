"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { Button, Input, Label, Spinner } from "@/components/ui";

export default function JoinPage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "invalid" | "ready">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/accept?inviteId=${inviteId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setEmail(d.email);
          setClientName(d.clientName);
          setState("ready");
        } else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [inviteId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, displayName, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join.");
      await signInWithCustomToken(firebaseAuth(), data.token);
      router.replace("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
      setBusy(false);
    }
  }

  if (state === "loading") return <Spinner />;
  if (state === "invalid") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-medium text-red-800">This invite link is invalid or has expired.</p>
          <p className="mt-2 text-sm text-red-600">Ask your team to send a new one.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900">
          Join {clientName ?? "your team"}
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          You’ve been invited as <span className="font-medium">{email}</span>
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl bg-white p-6 shadow-sm">
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
            <Label htmlFor="password">Choose a password</Label>
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
            {busy ? "Joining…" : "Join"}
          </Button>
        </form>
      </div>
    </main>
  );
}
