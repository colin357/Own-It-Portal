"use client";

import Link from "next/link";
import { orderBy, where } from "firebase/firestore";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection, useDoc } from "@/lib/firestore/hooks";
import { Spinner } from "@/components/ui";
import { TaskList } from "@/components/tasks/TaskList";
import type { Client, Task } from "@/lib/types";

export default function ClientHome() {
  const { clientId, profile } = useAuth();
  const { data: client } = useDoc<Client>(clientId ? `clients/${clientId}` : null);
  const { data: tasks, loading } = useCollection<Task>(
    clientId ? "tasks" : null,
    `home-${clientId}`,
    [where("clientId", "==", clientId ?? ""), orderBy("dueDate", "asc")]
  );

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const progress = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{profile ? `, ${profile.displayName.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {client?.status === "onboarding"
            ? "Let’s get you onboarded — work through your tasks below."
            : "Here’s what needs your attention."}
        </p>
      </div>

      {tasks.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Your progress</span>
            <span className="text-gray-500">
              {done.length}/{tasks.length} tasks done
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <TaskList
          tasks={open}
          clientId={clientId ?? ""}
          emptyTitle="You’re all caught up! 🎉"
          emptyHint="New tasks from your Own It Social team will show up here."
        />
      )}

      {done.length > 0 && (
        <p className="text-center text-sm text-gray-400">
          {done.length} completed — <Link href="/portal/tasks" className="text-indigo-600 hover:underline">view all tasks</Link>
        </p>
      )}
    </div>
  );
}
