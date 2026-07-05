"use client";

import { useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCollection } from "@/lib/firestore/hooks";
import { Badge, Select, Spinner, cn } from "@/components/ui";
import { DueDateChip, PriorityBadge } from "@/components/tasks/badges";
import type { Client, Task, TaskStatus } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "waiting_on_client", "done"];

export default function BoardPage() {
  const { data: tasks, loading } = useCollection<Task>("tasks", "board-open", [
    where("status", "!=", "done"),
  ]);
  const { data: doneTasks } = useCollection<Task>("tasks", "board-done", [
    where("status", "==", "done"),
  ]);
  const { data: clients } = useCollection<Client>("clients", "clients");
  const [clientFilter, setClientFilter] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);

  const clientById = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients]
  );

  const all = useMemo(() => {
    // Show only the 20 most recent done tasks to keep the column light.
    const done = [...doneTasks]
      .sort((a, b) => (b.completedAt?.toMillis() ?? 0) - (a.completedAt?.toMillis() ?? 0))
      .slice(0, 20);
    let list = [...tasks, ...done];
    if (clientFilter) list = list.filter((t) => t.clientId === clientFilter);
    return list;
  }, [tasks, doneTasks, clientFilter]);

  async function moveTo(taskId: string, status: TaskStatus) {
    await updateDoc(doc(db(), "tasks", taskId), {
      status,
      completedAt: status === "done" ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Task Board</h1>
        <Select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="w-48"
          aria-label="Filter by client"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const colTasks = all
              .filter((t) => t.status === col)
              .sort((a, b) => (a.dueDate?.toMillis() ?? Infinity) - (b.dueDate?.toMillis() ?? Infinity));
            return (
              <div
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col);
                }}
                onDragLeave={() => setOverCol(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverCol(null);
                  if (dragging) moveTo(dragging, col);
                  setDragging(null);
                }}
                className={cn(
                  "rounded-xl border bg-gray-100/60 p-3 transition-colors",
                  overCol === col ? "border-indigo-400 bg-indigo-50" : "border-gray-200"
                )}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-sm font-semibold text-gray-700">
                    {TASK_STATUS_LABELS[col]}
                  </p>
                  <span className="text-xs text-gray-400">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragging(t.id)}
                      onDragEnd={() => setDragging(null)}
                      className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                    >
                      <p className="text-sm font-medium text-gray-900">{t.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge color="gray">{clientById[t.clientId]?.name ?? "—"}</Badge>
                        <PriorityBadge priority={t.priority} />
                      </div>
                      <div className="mt-1.5">
                        <DueDateChip dueDate={t.dueDate} done={col === "done"} />
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-gray-400">No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-400">
        Drag cards between columns to update their status. The Done column shows the 20 most
        recently completed tasks.
      </p>
    </div>
  );
}
