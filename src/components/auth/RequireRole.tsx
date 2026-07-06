"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Spinner } from "@/components/ui";
import type { Role } from "@/lib/types";

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, role: userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (userRole !== role) {
      // No role at all -> home page, which explains the problem instead of looping.
      router.replace(userRole === "admin" ? "/admin" : userRole === "client" ? "/portal" : "/");
    }
  }, [user, userRole, loading, role, router]);

  if (loading || !user || userRole !== role) return <Spinner />;
  return <>{children}</>;
}
