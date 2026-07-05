"use client";

import { useState } from "react";
import { orderBy, where } from "firebase/firestore";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/lib/firestore/hooks";
import { Spinner, Tabs } from "@/components/ui";
import { TaskList } from "@/components/tasks/TaskList";
import type { Task } from "@/lib/types";

export default function ClientTasksPage() {
  const { clientId } = useAuth();
  const [tab, setTab] = useState("open");
  const { data: tasks, loading } = useCollection<Task>(
    clientId ? "tasks" : null,
    `tasks-${clientId}`,
    [where("clientId", "==", clientId ?? ""), orderBy("dueDate", "asc")]
  );

  const filtered =
    tab === "open" ? tasks.filter((t) => t.status !== "done") : tasks.filter((t) => t.status === "done");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
      <Tabs
        tabs={[
          { key: "open", label: "Open" },
          { key: "done", label: "Completed" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {loading ? (
        <Spinner />
      ) : (
        <TaskList
          tasks={filtered}
          clientId={clientId ?? ""}
          emptyTitle={tab === "open" ? "No open tasks" : "No completed tasks yet"}
        />
      )}
    </div>
  );
}
