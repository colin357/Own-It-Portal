"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { TeamManager } from "@/components/team/TeamManager";
import { Spinner } from "@/components/ui";

export default function ClientTeamPage() {
  const { clientId } = useAuth();
  if (!clientId) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Team</h1>
      <TeamManager clientId={clientId} />
    </div>
  );
}
