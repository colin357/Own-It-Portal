"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function Shell({
  nav,
  title,
  children,
}: {
  nav: NavItem[];
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const navLinks = (
    <nav className="flex-1 space-y-1 px-3">
      {nav.map((item) => {
        const active =
          item.href === pathname ||
          (item.href !== nav[0].href && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="px-6 py-5">
          <p className="text-base font-bold text-gray-900">Own It Social</p>
          <p className="text-xs text-gray-400">{title}</p>
        </div>
        {navLinks}
        <div className="border-t border-gray-200 p-4">
          <p className="truncate text-sm font-medium text-gray-700">
            {profile?.displayName}
          </p>
          <p className="truncate text-xs text-gray-400">{profile?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 text-xs font-medium text-gray-500 hover:text-red-600"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <p className="font-bold text-gray-900">Own It Social</p>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Menu"
          >
            ☰
          </button>
        </header>
        {menuOpen && (
          <div className="border-b border-gray-200 bg-white py-3 md:hidden">
            {navLinks}
            <button
              onClick={handleLogout}
              className="mt-2 px-6 text-sm font-medium text-gray-500 hover:text-red-600"
            >
              Log out
            </button>
          </div>
        )}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
