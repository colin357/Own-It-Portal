"use client";

import { useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, EmptyState, Modal, cn } from "@/components/ui";
import { DueDateChip, PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { TaskForm } from "@/components/tasks/TaskForm";
import { VideoEmbed } from "@/components/video/VideoEmbed";
import type { Task } from "@/lib/types";

export function TaskList({
  tasks,
  clientId,
  emptyTitle = "No tasks yet",
  emptyHint,
}: {
  tasks: Task[];
  clientId: string;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const { role } = useAuth();
  const [editing, setEditing] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function toggleDone(task: Task) {
    const done = task.status !== "done";
    await updateDoc(doc(db(), "tasks", task.id), {
      status: done ? "done" : "todo",
      completedAt: done ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  }

  async function remove(task: Task) {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    await deleteDoc(doc(db(), "tasks", task.id));
  }

  if (tasks.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <>
      <ul className="space-y-3">
        {tasks.map((task) => {
          const isOpen = expanded === task.id;
          const done = task.status === "done";
          return (
            <li
              key={task.id}
              className={cn(
                "rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
                done && "opacity-60"
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggleDone(task)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
                  aria-label={`Mark "${task.title}" ${done ? "not done" : "done"}`}
                />
                <div className="min-w-0 flex-1">
                  <button
                    className="text-left"
                    onClick={() => setExpanded(isOpen ? null : task.id)}
                  >
                    <p
                      className={cn(
                        "text-sm font-medium text-gray-900",
                        done && "line-through"
                      )}
                    >
                      {task.title}
                      {task.videoUrl && <span className="ml-2" aria-label="Has video">🎬</span>}
                    </p>
                  </button>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                    <DueDateChip dueDate={task.dueDate} done={done} />
                  </div>
                  {isOpen && (
                    <div className="mt-3 space-y-3">
                      {task.description && (
                        <p className="whitespace-pre-wrap text-sm text-gray-600">
                          {task.description}
                        </p>
                      )}
                      {task.videoUrl && <VideoEmbed url={task.videoUrl} />}
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(task)}>
                          Edit
                        </Button>
                        {role === "admin" && (
                          <Button size="sm" variant="danger" onClick={() => remove(task)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit task" wide>
        {editing && (
          <TaskForm clientId={clientId} task={editing} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </>
  );
}
