"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase/client";
import { useCollection, useDoc } from "@/lib/firestore/hooks";
import { Badge, Button, Modal, Select, Spinner, Tabs, cn } from "@/components/ui";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskList } from "@/components/tasks/TaskList";
import { ContentForm } from "@/components/content/ContentForm";
import { ContentList } from "@/components/content/ContentList";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { FileManager } from "@/components/files/FileManager";
import { TeamManager } from "@/components/team/TeamManager";
import type { Client, ClientStatus, ContentItem, Tag, Task } from "@/lib/types";

const TABS = [
  { key: "tasks", label: "Tasks" },
  { key: "content", label: "Content" },
  { key: "calendar", label: "Calendar" },
  { key: "files", label: "Files" },
  { key: "team", label: "Team" },
];

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState("tasks");
  const [applying, setApplying] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [newContent, setNewContent] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const { data: client, loading } = useDoc<Client>(`clients/${clientId}`);
  const { data: tags } = useCollection<Tag>("tags", "tags");
  const { data: tasks } = useCollection<Task>("tasks", `client-tasks-${clientId}`, [
    where("clientId", "==", clientId),
    orderBy("dueDate", "asc"),
  ]);
  const { data: content } = useCollection<ContentItem>(
    "contentItems",
    `client-content-${clientId}`,
    [where("clientId", "==", clientId), orderBy("createdAt", "desc")]
  );

  if (loading) return <Spinner />;
  if (!client) return <p className="text-sm text-gray-500">Client not found.</p>;

  const clientTags = tags.filter((t) => client.tagIds?.includes(t.id));
  const availableTags = tags.filter((t) => !client.tagIds?.includes(t.id));
  const visibleTasks = showDone ? tasks : tasks.filter((t) => t.status !== "done");

  async function setStatus(status: ClientStatus) {
    await updateDoc(doc(db(), "clients", clientId), { status });
  }

  async function addTag(tagId: string) {
    if (!tagId) return;
    await updateDoc(doc(db(), "clients", clientId), { tagIds: arrayUnion(tagId) });
  }

  async function removeTag(tagId: string) {
    await updateDoc(doc(db(), "clients", clientId), { tagIds: arrayRemove(tagId) });
  }

  // Copies active onboarding templates into this client's tasks,
  // skipping templates the client already has a task for.
  async function applyTemplates() {
    setApplying(true);
    try {
      const snap = await getDocs(
        query(collection(db(), "taskTemplates"), where("active", "==", true))
      );
      const existing = new Set(tasks.map((t) => t.templateId).filter(Boolean));
      const fresh = snap.docs
        .filter((d) => !existing.has(d.id))
        .sort((a, b) => (a.data().order ?? 0) - (b.data().order ?? 0));
      await Promise.all(
        fresh.map((d, i) => {
          const tpl = d.data();
          return addDoc(collection(db(), "tasks"), {
            clientId,
            title: tpl.title ?? "Onboarding task",
            description: tpl.description ?? "",
            status: "todo",
            priority: tpl.priority ?? "medium",
            dueDate:
              typeof tpl.dueOffsetDays === "number"
                ? Timestamp.fromMillis(Date.now() + tpl.dueOffsetDays * 86400000)
                : null,
            videoUrl: tpl.videoUrl ?? null,
            attachments: [],
            createdBy: { uid: user?.uid ?? "admin", role: "admin" },
            assignedTo: "client",
            templateId: d.id,
            order: i,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            completedAt: null,
          });
        })
      );
      if (fresh.length === 0) alert("This client already has all active onboarding tasks.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {clientTags.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1">
                <Badge color="indigo">{t.name}</Badge>
                <button
                  onClick={() => removeTag(t.id)}
                  className="text-xs text-gray-300 hover:text-red-500"
                  aria-label={`Remove tag ${t.name}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {availableTags.length > 0 && (
              <Select
                value=""
                onChange={(e) => addTag(e.target.value)}
                className="w-32 !py-1 text-xs"
                aria-label="Add tag"
              >
                <option value="">+ Add tag</option>
                {availableTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
        <Select
          value={client.status}
          onChange={(e) => setStatus(e.target.value as ClientStatus)}
          className={cn(
            "w-36",
            client.status === "onboarding" && "border-yellow-300 bg-yellow-50",
            client.status === "active" && "border-green-300 bg-green-50"
          )}
          aria-label="Client status"
        >
          <option value="onboarding">Onboarding</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-500">
              <input
                type="checkbox"
                checked={showDone}
                onChange={(e) => setShowDone(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              Show completed
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={applyTemplates} disabled={applying}>
                {applying ? "Applying…" : "Apply onboarding templates"}
              </Button>
              <Button onClick={() => setNewTask(true)}>+ New task</Button>
            </div>
          </div>
          <TaskList
            tasks={visibleTasks}
            clientId={clientId}
            emptyTitle="No tasks for this client"
            emptyHint="Create a task or apply the onboarding templates."
          />
        </div>
      )}

      {tab === "content" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setNewContent(true)}>+ New content</Button>
          </div>
          <ContentList
            items={content}
            clientId={clientId}
            emptyTitle="No content for this client yet"
          />
        </div>
      )}

      {tab === "calendar" && <MonthCalendar items={content} />}
      {tab === "files" && <FileManager clientId={clientId} />}
      {tab === "team" && <TeamManager clientId={clientId} />}

      <Modal open={newTask} onClose={() => setNewTask(false)} title="New task" wide>
        <TaskForm clientId={clientId} onDone={() => setNewTask(false)} />
      </Modal>
      <Modal open={newContent} onClose={() => setNewContent(false)} title="New content" wide>
        <ContentForm clientId={clientId} onDone={() => setNewContent(false)} />
      </Modal>
    </div>
  );
}
