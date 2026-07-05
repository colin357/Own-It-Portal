"use client";

import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCollection } from "@/lib/firestore/hooks";
import { Badge, Button, EmptyState, Input, Spinner } from "@/components/ui";
import type { Tag } from "@/lib/types";

export default function TagsPage() {
  const { data: tags, loading } = useCollection<Tag>("tags", "tags");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await addDoc(collection(db(), "tags"), { name: name.trim(), color: "indigo" });
    setName("");
    setBusy(false);
  }

  async function remove(tag: Tag) {
    if (!confirm(`Delete tag "${tag.name}"? It will disappear from all clients.`)) return;
    await deleteDoc(doc(db(), "tags", tag.id));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
        <p className="mt-1 text-sm text-gray-500">
          Use tags to group clients — by service package, industry, or anything else.
        </p>
      </div>

      <form onSubmit={create} className="flex gap-3">
        <Input
          placeholder="New tag name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          Add tag
        </Button>
      </form>

      {loading ? (
        <Spinner />
      ) : tags.length === 0 ? (
        <EmptyState title="No tags yet" hint="Add your first tag above." />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
          {[...tags]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3">
                <Badge color="indigo">{t.name}</Badge>
                <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                  Delete
                </Button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
