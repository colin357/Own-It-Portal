"use client";

import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, EmptyState, Modal } from "@/components/ui";
import { ContentForm } from "@/components/content/ContentForm";
import type { ContentItem, ContentStatus } from "@/lib/types";
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS } from "@/lib/types";
import { format } from "date-fns";

const STATUS_COLORS: Record<ContentStatus, "gray" | "yellow" | "blue" | "green"> = {
  idea: "gray",
  draft: "yellow",
  scheduled: "blue",
  published: "green",
};

export function ContentList({
  items,
  clientId,
  emptyTitle = "Nothing here yet",
  emptyHint,
}: {
  items: ContentItem[];
  clientId: string;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const { role } = useAuth();
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function remove(item: ContentItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    await deleteDoc(doc(db(), "contentItems", item.id));
  }

  if (items.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <>
      <ul className="space-y-3">
        {items.map((item) => {
          const isOpen = expanded === item.id;
          return (
            <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <button
                className="w-full text-left"
                onClick={() => setExpanded(isOpen ? null : item.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge color="indigo">{CONTENT_TYPE_LABELS[item.type]}</Badge>
                    <Badge color={STATUS_COLORS[item.status]}>
                      {CONTENT_STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {item.scheduledDate
                    ? `Scheduled for ${format(item.scheduledDate.toDate(), "MMM d, yyyy")}`
                    : "Not scheduled"}
                </p>
              </button>
              {isOpen && (
                <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                  {item.body && (
                    <p className="whitespace-pre-wrap text-sm text-gray-600">{item.body}</p>
                  )}
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Open link ↗
                    </a>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                    {role === "admin" && (
                      <Button size="sm" variant="danger" onClick={() => remove(item)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit content" wide>
        {editing && (
          <ContentForm clientId={clientId} item={editing} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </>
  );
}
