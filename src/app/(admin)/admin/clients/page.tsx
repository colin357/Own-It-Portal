"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCollection } from "@/lib/firestore/hooks";
import { Badge, Input, Select, Spinner, EmptyState } from "@/components/ui";
import type { Client, Tag } from "@/lib/types";

const STATUS_COLORS = {
  onboarding: "yellow",
  active: "green",
  archived: "gray",
} as const;

export default function ClientsPage() {
  const { data: clients, loading } = useCollection<Client>("clients", "clients");
  const { data: tags } = useCollection<Tag>("tags", "tags");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const tagById = useMemo(() => Object.fromEntries(tags.map((t) => [t.id, t])), [tags]);

  const filtered = clients.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (tagFilter && !c.tagIds?.includes(tagFilter)) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Clients</h1>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
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
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="onboarding">Onboarding</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No clients found"
          hint="Clients appear here automatically when they sign up."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clients/${c.id}`}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900">{c.name}</p>
                <Badge color={STATUS_COLORS[c.status] ?? "gray"}>{c.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(c.tagIds ?? []).map((id) =>
                  tagById[id] ? (
                    <Badge key={id} color="indigo">
                      {tagById[id].name}
                    </Badge>
                  ) : null
                )}
                {(c.tagIds ?? []).length === 0 && (
                  <span className="text-xs text-gray-300">No tags</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
