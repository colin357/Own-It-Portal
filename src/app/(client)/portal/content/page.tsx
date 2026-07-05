"use client";

import { useState } from "react";
import { orderBy, where } from "firebase/firestore";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/lib/firestore/hooks";
import { Button, Modal, Spinner, Tabs } from "@/components/ui";
import { ContentForm } from "@/components/content/ContentForm";
import { ContentList } from "@/components/content/ContentList";
import type { ContentItem, ContentType } from "@/lib/types";

const TABS: { key: string; label: string; type: ContentType | null }[] = [
  { key: "all", label: "All", type: null },
  { key: "idea", label: "Content Ideas", type: "idea" },
  { key: "email_blast", label: "Email Blasts", type: "email_blast" },
  { key: "blog_post", label: "Blog Posts", type: "blog_post" },
  { key: "social_post", label: "Social Posts", type: "social_post" },
];

export default function ClientContentPage() {
  const { clientId } = useAuth();
  const [tab, setTab] = useState("all");
  const [creating, setCreating] = useState(false);
  const { data: items, loading } = useCollection<ContentItem>(
    clientId ? "contentItems" : null,
    `content-${clientId}`,
    [where("clientId", "==", clientId ?? ""), orderBy("createdAt", "desc")]
  );

  const activeType = TABS.find((t) => t.key === tab)?.type ?? null;
  const filtered = activeType ? items.filter((i) => i.type === activeType) : items;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Content</h1>
        <Button onClick={() => setCreating(true)}>+ Submit an idea</Button>
      </div>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {loading ? (
        <Spinner />
      ) : (
        <ContentList
          items={filtered}
          clientId={clientId ?? ""}
          emptyTitle="No content here yet"
          emptyHint="Content your team creates — and ideas you submit — will show up here."
        />
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Submit a content idea" wide>
        <ContentForm
          clientId={clientId ?? ""}
          defaultType="idea"
          onDone={() => setCreating(false)}
        />
      </Modal>
    </div>
  );
}
