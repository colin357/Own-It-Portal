"use client";

import { useMemo, useState } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Label, Select, Textarea } from "@/components/ui";
import type { ContentStatus, ContentType } from "@/lib/types";
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS } from "@/lib/types";

/** Splits pasted text into ideas: one per line, "Title | Details" optional. */
function parseLines(text: string): { title: string; body: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf("|");
      if (sep === -1) return { title: line, body: "" };
      return { title: line.slice(0, sep).trim(), body: line.slice(sep + 1).trim() };
    })
    .filter((i) => i.title);
}

/**
 * Paste many ideas at once (one per line) instead of filling out the form for
 * each. Writes them all to the client's content list in a single batch.
 */
export function BulkContentAdd({
  clientId,
  onDone,
}: {
  clientId: string;
  onDone: () => void;
}) {
  const { user, role } = useAuth();
  const [text, setText] = useState("");
  const [type, setType] = useState<ContentType>("idea");
  const [status, setStatus] = useState<ContentStatus>("idea");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseLines(text), [text]);

  async function onSubmit() {
    if (!user || !role) return;
    if (parsed.length === 0) {
      setError("Add at least one idea (one per line).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const batch = writeBatch(db());
      const col = collection(db(), "contentItems");
      for (const idea of parsed) {
        batch.set(doc(col), {
          clientId,
          type,
          title: idea.title.slice(0, 200),
          body: idea.body.slice(0, 5000),
          status,
          scheduledDate: null,
          link: null,
          attachments: [],
          createdBy: { uid: user.uid, role },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add ideas.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="bulk-type">Type</Label>
          <Select
            id="bulk-type"
            value={type}
            onChange={(e) => setType(e.target.value as ContentType)}
          >
            {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bulk-status">Status</Label>
          <Select
            id="bulk-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ContentStatus)}
          >
            {Object.entries(CONTENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="bulk-text">Ideas — one per line</Label>
        <Textarea
          id="bulk-text"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "5 signs your water heater is failing | Educational post, end with a service CTA\n" +
            "Behind the scenes: a day with our install crew\n" +
            "Customer spotlight: the Johnson family kitchen remodel"
          }
        />
        <p className="mt-1 text-xs text-gray-400">
          Add optional details after a <code className="rounded bg-gray-100 px-1">|</code> on each
          line. You can set dates and links later by editing an item.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          {parsed.length} idea{parsed.length === 1 ? "" : "s"} ready to add
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || parsed.length === 0} onClick={onSubmit}>
            {busy ? "Adding…" : `Add ${parsed.length || ""} idea${parsed.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
