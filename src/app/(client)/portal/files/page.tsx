"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { FileManager } from "@/components/files/FileManager";
import { Spinner } from "@/components/ui";

export default function ClientFilesPage() {
  const { clientId } = useAuth();
  if (!clientId) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Files</h1>
        <p className="mt-1 text-sm text-gray-500">
          Share photos, videos, and documents with your Own It Social team.
        </p>
      </div>
      <FileManager clientId={clientId} />
    </div>
  );
}
