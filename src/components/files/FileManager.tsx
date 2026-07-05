"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytesResumable,
  type StorageReference,
} from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, EmptyState, Spinner } from "@/components/ui";

interface StoredFile {
  name: string;
  fullPath: string;
  url: string;
}

export function FileManager({ clientId }: { clientId: string }) {
  const { role } = useAuth();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const folder = `portal/${clientId}/uploads`;

  async function load() {
    setLoading(true);
    try {
      const res = await listAll(ref(storage(), folder));
      const items = await Promise.all(
        res.items.map(async (item: StorageReference) => ({
          name: item.name,
          fullPath: item.fullPath,
          url: await getDownloadURL(item),
        }))
      );
      setFiles(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load files.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function upload(file: File) {
    setError(null);
    const dest = ref(storage(), `${folder}/${Date.now()}-${file.name}`);
    const task = uploadBytesResumable(dest, file);
    task.on(
      "state_changed",
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => {
        setError(err.message);
        setProgress(null);
      },
      async () => {
        setProgress(null);
        await load();
      }
    );
  }

  async function remove(file: StoredFile) {
    if (!confirm(`Delete ${file.name}?`)) return;
    await deleteObject(ref(storage(), file.fullPath));
    await load();
  }

  const isImage = (name: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(name);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={progress !== null}>
          {progress !== null ? `Uploading… ${progress}%` : "⬆ Upload a file"}
        </Button>
        <p className="text-xs text-gray-400">Photos, videos, and documents</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <Spinner />
      ) : files.length === 0 ? (
        <EmptyState
          title="No files yet"
          hint="Upload brand photos, videos, or documents to share with your team."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => (
            <div
              key={file.fullPath}
              className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {isImage(file.name) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.name} className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-32 items-center justify-center bg-gray-50 text-3xl">
                  📄
                </div>
              )}
              <div className="p-2">
                <p className="truncate text-xs text-gray-600" title={file.name}>
                  {file.name.replace(/^\d+-/, "")}
                </p>
                <div className="mt-1 flex gap-2">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    Open
                  </a>
                  {role === "admin" && (
                    <button
                      onClick={() => remove(file)}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
