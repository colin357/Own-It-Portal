"use client";

import { Badge } from "@/components/ui";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";
import type { Timestamp } from "firebase/firestore";
import { format, isPast, isToday } from "date-fns";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const colors = {
    low: "gray",
    medium: "blue",
    high: "orange",
    urgent: "red",
  } as const;
  return <Badge color={colors[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const colors = {
    todo: "gray",
    in_progress: "blue",
    waiting_on_client: "yellow",
    done: "green",
  } as const;
  return <Badge color={colors[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function DueDateChip({
  dueDate,
  done,
}: {
  dueDate: Timestamp | null;
  done?: boolean;
}) {
  if (!dueDate) return <span className="text-xs text-gray-400">No due date</span>;
  const d = dueDate.toDate();
  const overdue = !done && isPast(d) && !isToday(d);
  return (
    <span
      className={
        overdue ? "text-xs font-semibold text-red-600" : "text-xs text-gray-500"
      }
    >
      {overdue ? "Overdue — " : "Due "}
      {format(d, "MMM d, yyyy")}
    </span>
  );
}
