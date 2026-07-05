"use client";

import type { ReactNode } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { Shell, type NavItem } from "@/components/layout/Shell";

const NAV: NavItem[] = [
  { href: "/portal", label: "Home", icon: "🏠" },
  { href: "/portal/tasks", label: "My Tasks", icon: "✅" },
  { href: "/portal/content", label: "Content", icon: "💡" },
  { href: "/portal/calendar", label: "Calendar", icon: "📅" },
  { href: "/portal/files", label: "Files", icon: "📁" },
  { href: "/portal/team", label: "Team", icon: "👥" },
];

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="client">
      <Shell nav={NAV} title="Client Portal">
        {children}
      </Shell>
    </RequireRole>
  );
}
