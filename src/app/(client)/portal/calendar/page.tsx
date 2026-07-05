"use client";

import { where } from "firebase/firestore";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCollection } from "@/lib/firestore/hooks";
import { Spinner } from "@/components/ui";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import type { ContentItem } from "@/lib/types";

export default function ClientCalendarPage() {
  const { clientId } = useAuth();
  const { data: items, loading } = useCollection<ContentItem>(
    clientId ? "contentItems" : null,
    `calendar-${clientId}`,
    [where("clientId", "==", clientId ?? "")]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everything scheduled for your brand — email blasts, blog posts, and social content.
        </p>
      </div>
      {loading ? <Spinner /> : <MonthCalendar items={items} />}
    </div>
  );
}
