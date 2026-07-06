"use client";

import { useState, type FormEvent } from "react";
import { orderBy, where } from "firebase/firestore";
import { useCollection } from "@/lib/firestore/hooks";
import { getAuthToken } from "@/lib/clientSession";
import { Badge, Button, EmptyState, Input, Label, Spinner } from "@/components/ui";
import type { Invite, PortalUser } from "@/lib/types";

export function TeamManager({ clientId }: { clientId: string }) {
  const { data: members, loading: loadingMembers } = useCollection<PortalUser>(
    "portalUsers",
    `members-${clientId}`,
    [where("clientId", "==", clientId)]
  );
  const { data: invites } = useCollection<Invite>(
    "invites",
    `invites-${clientId}`,
    [where("clientId", "==", clientId), orderBy("createdAt", "desc")]
  );

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [copied, setCopied] = useState(false);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNewLink(null);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/invite/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, clientId, phone: phone.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create invite.");
      setNewLink(`${window.location.origin}/join/${data.inviteId}`);
      setSmsSent(Boolean(data.smsSent));
      setEmail("");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invite.");
    }
    setBusy(false);
  }

  async function copy(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const pending = invites.filter((i) => i.status === "pending");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Members</h2>
        {loadingMembers ? (
          <Spinner />
        ) : members.length === 0 ? (
          <EmptyState title="No members found" />
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {members.map((m) => (
              <li key={m.uid ?? m.email} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.displayName}</p>
                  <p className="text-xs text-gray-500">{m.email}</p>
                </div>
                {m.isOwner && <Badge color="indigo">Owner</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Invite a teammate</h2>
        <p className="mb-3 text-sm text-gray-500">
          Add an assistant or colleague — they’ll get their own login with access to this
          account.
        </p>
        <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="invite-email">Their email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="assistant@example.com"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="invite-phone">Their mobile (optional — texts the link)</Label>
            <Input
              id="invite-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create invite"}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {newLink && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm font-medium text-green-800">
              Invite created!{" "}
              {smsSent ? "We texted them the link — you can also share it directly:" : "Send them this link:"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs text-gray-700">
                {newLink}
              </code>
              <Button size="sm" variant="secondary" onClick={() => copy(newLink)}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Pending invites</h2>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-gray-700">{i.email}</p>
                <div className="flex items-center gap-2">
                  <Badge color="yellow">Pending</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copy(`${window.location.origin}/join/${i.id}`)}
                  >
                    Copy link
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
