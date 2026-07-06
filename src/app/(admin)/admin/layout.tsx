"use client";

import type { ReactNode } from "react";
import { RequireRole } from "@/components/auth/RequireRole";
import { Shell, type NavItem } from "@/components/layout/Shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/board", label: "Task Board", icon: "🗂️" },
  { href: "/admin/clients", label: "Clients", icon: "👥" },
  { href: "/admin/templates", label: "Onboarding Templates", icon: "✅" },
  { href: "/admin/tags", label: "Tags", icon: "🏷️" },
  { href: "/admin/migrate", label: "Migration", icon: "📦" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole role="admin">
      <Shell nav={NAV} title="Admin">
        {children}
      </Shell>
    </RequireRole>
  );
}
