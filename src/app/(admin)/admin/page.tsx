"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { where } from "firebase/firestore";
import { useCollection } from "@/lib/firestore/hooks";
import { Badge, Select, Spinner, cn } from "@/components/ui";
import { DueDateChip, PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import type { Client, Tag, Task } from "@/lib/types";
import { isPast, isToday, addDays } from "date-fns";

export default function AdminDashboard() {
  const { data: tasks, loading } = useCollection<Task>("tasks", "open-tasks", [
    where("status", "!=", "done"),
  ]);
  const { data: clients } = useCollection<Client>("clients", "clients");
  const { data: tags } = useCollection<Tag>("tags", "tags");

  const [clientFilter, setClientFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const clientById = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients]
  );

  const filtered = useMemo(() => {
    let list = tasks;
    if (clientFilter) list = list.filter((t) => t.clientId === clientFilter);
    if (tagFilter)
      list = list.filter((t) => clientById[t.clientId]?.tagIds?.includes(tagFilter));
    return [...list].sort((a, b) => {
      const ad = a.dueDate?.toMillis() ?? Infinity;
      const bd = b.dueDate?.toMillis() ?? Infinity;
      return ad - bd;
    });
  }, [tasks, clientFilter, tagFilter, clientById]);

  const now = new Date();
  const overdue = tasks.filter(
    (t) => t.dueDate && isPast(t.dueDate.toDate()) && !isToday(t.dueDate.toDate())
  );
  const dueThisWeek = tasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = t.dueDate.toDate();
    return d <= addDays(now, 7) && (!isPast(d) || isToday(d));
  });
  const waiting = tasks.filter((t) => t.status === "waiting_on_client");
  const onboarding = clients.filter((c) => c.status === "onboarding");

  const stats = [
    { label: "Overdue tasks", value: overdue.length, tone: "text-red-600" },
    { label: "Due this week", value: dueThisWeek.length, tone: "text-orange-600" },
    { label: "Waiting on client", value: waiting.length, tone: "text-yellow-600" },
    { label: "Clients onboarding", value: onboarding.length, tone: "text-indigo-600" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className={cn("text-2xl font-bold", s.tone)}>{s.value}</p>
            <p className="mt-1 text-xs font-medium text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Open tasks — all clients</h2>
        <div className="ml-auto flex gap-2">
          <Select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="w-44"
            aria-label="Filter by client"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-40"
            aria-label="Filter by tag"
          >
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Urgency</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No open tasks match these filters. 🎉
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link href={`/admin/clients/${t.clientId}`} className="hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color="gray">{clientById[t.clientId]?.name ?? "—"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <DueDateChip dueDate={t.dueDate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
