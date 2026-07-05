"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { Badge, Button, Modal, cn } from "@/components/ui";
import type { ContentItem, ContentType } from "@/lib/types";
import { CONTENT_TYPE_LABELS } from "@/lib/types";

const TYPE_DOT: Record<ContentType, string> = {
  idea: "bg-gray-400",
  email_blast: "bg-purple-500",
  blog_post: "bg-green-500",
  social_post: "bg-blue-500",
};

export function MonthCalendar({ items }: { items: ContentItem[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  function itemsOn(day: Date) {
    return items.filter(
      (i) => i.scheduledDate && isSameDay(i.scheduledDate.toDate(), day)
    );
  }

  const selectedItems = selected ? itemsOn(selected) : [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {format(month, "MMMM yyyy")}
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setMonth(subMonths(month, 1))}>
            ←
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMonth(addMonths(month, 1))}>
            →
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-gray-200">
        {days.map((day) => {
          const dayItems = itemsOn(day);
          return (
            <button
              key={day.toISOString()}
              onClick={() => dayItems.length && setSelected(day)}
              className={cn(
                "min-h-[72px] bg-white p-1.5 text-left align-top hover:bg-gray-50",
                !isSameMonth(day, month) && "bg-gray-50 text-gray-300"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday(day) ? "bg-indigo-600 font-semibold text-white" : "text-gray-600"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 3).map((i) => (
                  <div key={i.id} className="flex items-center gap-1 truncate text-[10px] text-gray-600">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TYPE_DOT[i.type])} />
                    <span className="truncate">{i.title}</span>
                  </div>
                ))}
                {dayItems.length > 3 && (
                  <p className="text-[10px] text-gray-400">+{dayItems.length - 3} more</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {Object.entries(TYPE_DOT).map(([type, dot]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={cn("h-2 w-2 rounded-full", dot)} />
            {CONTENT_TYPE_LABELS[type as ContentType]}
          </span>
        ))}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? format(selected, "MMMM d, yyyy") : ""}
      >
        <ul className="space-y-3">
          {selectedItems.map((i) => (
            <li key={i.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{i.title}</p>
                <Badge color="indigo">{CONTENT_TYPE_LABELS[i.type]}</Badge>
              </div>
              {i.body && <p className="mt-1 text-sm text-gray-600">{i.body}</p>}
              {i.link && (
                <a
                  href={i.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-sm text-indigo-600 hover:underline"
                >
                  Open link ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
