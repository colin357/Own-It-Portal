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
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/types";
import { format } from "date-fns";

export function TaskForm({
  clientId,
  task,
  onDone,
}: {
  clientId: string;
  task?: Task;
  onDone: () => void;
}) {
  const { user, role } = useAuth();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? format(task.dueDate.toDate(), "yyyy-MM-dd") : ""
  );
  const [videoUrl, setVideoUrl] = useState(task?.videoUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !role) return;
    setBusy(true);
    setError(null);
    try {
      const due = dueDate ? Timestamp.fromDate(new Date(dueDate + "T12:00:00")) : null;
      const fields = {
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        dueDate: due,
        videoUrl: videoUrl.trim() || null,
        updatedAt: serverTimestamp(),
        completedAt: status === "done" ? task?.completedAt ?? serverTimestamp() : null,
      };
      if (task) {
        await updateDoc(doc(db(), "tasks", task.id), fields);
      } else {
        await addDoc(collection(db(), "tasks"), {
          ...fields,
          clientId,
          attachments: [],
          createdBy: { uid: user.uid, role },
          assignedTo: role === "admin" ? "client" : "admin",
          templateId: null,
          order: 0,
          createdAt: serverTimestamp(),
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save task.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="task-title">Title</Label>
        <Input
          id="task-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="task-desc">Description</Label>
        <Textarea
          id="task-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="task-priority">Urgency</Label>
          <Select
            id="task-priority"
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
          <Label htmlFor="task-status">Status</Label>
          <Select
            id="task-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="task-due">Due date</Label>
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="task-video">Video link (Loom or Google Drive — optional)</Label>
        <Input
          id="task-video"
          type="url"
          placeholder="https://www.loom.com/share/…"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : task ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
