"use client";

import { useState, type FormEvent } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import type { ContentItem, ContentStatus, ContentType } from "@/lib/types";
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS } from "@/lib/types";
import { format } from "date-fns";

export function ContentForm({
  clientId,
  item,
  defaultType = "idea",
  onDone,
}: {
  clientId: string;
  item?: ContentItem;
  defaultType?: ContentType;
  onDone: () => void;
}) {
  const { user, role } = useAuth();
  const [type, setType] = useState<ContentType>(item?.type ?? defaultType);
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [status, setStatus] = useState<ContentStatus>(item?.status ?? "idea");
  const [scheduledDate, setScheduledDate] = useState(
    item?.scheduledDate ? format(item.scheduledDate.toDate(), "yyyy-MM-dd") : ""
  );
  const [link, setLink] = useState(item?.link ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !role) return;
    setBusy(true);
    setError(null);
    try {
      const fields = {
        type,
        title: title.trim(),
        body: body.trim(),
        status,
        scheduledDate: scheduledDate
          ? Timestamp.fromDate(new Date(scheduledDate + "T12:00:00"))
          : null,
        link: link.trim() || null,
        updatedAt: serverTimestamp(),
      };
      if (item) {
        await updateDoc(doc(db(), "contentItems", item.id), fields);
      } else {
        await addDoc(collection(db(), "contentItems"), {
          ...fields,
          clientId,
          attachments: [],
          createdBy: { uid: user.uid, role },
          createdAt: serverTimestamp(),
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="content-type">Type</Label>
          <Select
            id="content-type"
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
          <Label htmlFor="content-status">Status</Label>
          <Select
            id="content-status"
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
        <Label htmlFor="content-title">Title</Label>
        <Input
          id="content-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="content-body">Details</Label>
        <Textarea
          id="content-body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="content-date">Scheduled date</Label>
          <Input
            id="content-date"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="content-link">Link (blog post, doc, etc.)</Label>
          <Input
            id="content-link"
            type="url"
            placeholder="https://…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : item ? "Save changes" : "Create"}
        </Button>
      </div>
    </form>
  );
}
