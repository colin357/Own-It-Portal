"use client";

import { useState, type FormEvent } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCollection } from "@/lib/firestore/hooks";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Label,
  Modal,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { PriorityBadge } from "@/components/tasks/badges";
import type { TaskPriority, TaskTemplate } from "@/lib/types";
import { PRIORITY_LABELS } from "@/lib/types";

function TemplateForm({
  template,
  nextOrder,
  onDone,
}: {
  template?: TaskTemplate;
  nextOrder: number;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(template?.priority ?? "medium");
  const [dueOffsetDays, setDueOffsetDays] = useState(String(template?.dueOffsetDays ?? 7));
  const [videoUrl, setVideoUrl] = useState(template?.videoUrl ?? "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fields = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueOffsetDays: Math.max(0, parseInt(dueOffsetDays, 10) || 0),
      videoUrl: videoUrl.trim() || null,
    };
    if (template) {
      await updateDoc(doc(db(), "taskTemplates", template.id), fields);
    } else {
      await addDoc(collection(db(), "taskTemplates"), {
        ...fields,
        order: nextOrder,
        active: true,
      });
    }
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="tpl-title">Title</Label>
        <Input id="tpl-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="tpl-desc">Description</Label>
        <Textarea
          id="tpl-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tpl-priority">Urgency</Label>
          <Select
            id="tpl-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="tpl-offset">Due (days after signup)</Label>
          <Input
            id="tpl-offset"
            type="number"
            min={0}
            required
            value={dueOffsetDays}
            onChange={(e) => setDueOffsetDays(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="tpl-video">Video link (Loom or Google Drive — optional)</Label>
        <Input
          id="tpl-video"
          type="url"
          placeholder="https://www.loom.com/share/…"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : template ? "Save changes" : "Create template"}
        </Button>
      </div>
    </form>
  );
}

export default function TemplatesPage() {
  const { data: templates, loading } = useCollection<TaskTemplate>(
    "taskTemplates",
    "templates",
    [orderBy("order", "asc")]
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);

  async function toggleActive(t: TaskTemplate) {
    await updateDoc(doc(db(), "taskTemplates", t.id), { active: !t.active });
  }

  async function remove(t: TaskTemplate) {
    if (!confirm(`Delete template "${t.title}"?`)) return;
    await deleteDoc(doc(db(), "taskTemplates", t.id));
  }

  async function move(t: TaskTemplate, dir: -1 | 1) {
    const idx = templates.findIndex((x) => x.id === t.id);
    const other = templates[idx + dir];
    if (!other) return;
    await Promise.all([
      updateDoc(doc(db(), "taskTemplates", t.id), { order: other.order ?? 0 }),
      updateDoc(doc(db(), "taskTemplates", other.id), { order: t.order ?? 0 }),
    ]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Active templates are automatically assigned as tasks when a new client signs up.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>+ New template</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : templates.length === 0 ? (
        <EmptyState
          title="No onboarding templates yet"
          hint="Create your first template — e.g. “Fill out your brand questionnaire”."
        />
      ) : (
        <ul className="space-y-3">
          {templates.map((t, i) => (
            <li
              key={t.id}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => move(t, -1)}
                  disabled={i === 0}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-30"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(t, 1)}
                  disabled={i === templates.length - 1}
                  className="text-gray-300 hover:text-gray-600 disabled:opacity-30"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  <PriorityBadge priority={t.priority} />
                  {t.videoUrl && <span aria-label="Has video">🎬</span>}
                  {!t.active && <Badge color="gray">Inactive</Badge>}
                </div>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">{t.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Due {t.dueOffsetDays} day{t.dueOffsetDays === 1 ? "" : "s"} after signup
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(t)}>
                  {t.active ? "Deactivate" : "Activate"}
                </Button>
                <Button size="sm" variant="danger" onClick={() => remove(t)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New onboarding template" wide>
        <TemplateForm
          nextOrder={templates.length}
          onDone={() => setCreating(false)}
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit template" wide>
        {editing && (
          <TemplateForm
            template={editing}
            nextOrder={templates.length}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
