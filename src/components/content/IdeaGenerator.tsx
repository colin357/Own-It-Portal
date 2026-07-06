"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, firebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Input, Label, Modal } from "@/components/ui";

interface Idea {
  title: string;
  body: string;
  added?: boolean;
}

export function IdeaGenerator({ clientId }: { clientId: string }) {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const token = await firebaseAuth().currentUser?.getIdToken();
      const res = await fetch("/api/ai/ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientId, topic: topic.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate ideas.");
      setIdeas(data.ideas);
      if (data.ideas.length === 0) setError("No ideas came back — try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate ideas.");
    }
    setBusy(false);
  }

  async function addIdea(idx: number) {
    const idea = ideas[idx];
    if (!user || !role || idea.added) return;
    await addDoc(collection(db(), "contentItems"), {
      clientId,
      type: "idea",
      title: idea.title,
      body: idea.body,
      status: "idea",
      scheduledDate: null,
      link: null,
      attachments: [],
      createdBy: { uid: user.uid, role },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setIdeas((prev) => prev.map((i, j) => (j === idx ? { ...i, added: true } : i)));
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        ✨ Generate ideas
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="AI content ideas" wide>
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="idea-topic">Focus (optional)</Label>
              <Input
                id="idea-topic"
                placeholder="e.g. spring promotion, hiring, behind the scenes…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <Button onClick={generate} disabled={busy}>
              {busy ? "Thinking…" : ideas.length ? "Regenerate" : "Generate"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {ideas.length > 0 && (
            <ul className="max-h-96 space-y-3 overflow-y-auto">
              {ideas.map((idea, i) => (
                <li key={i} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{idea.title}</p>
                      <p className="mt-1 text-sm text-gray-600">{idea.body}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={idea.added ? "ghost" : "primary"}
                      disabled={idea.added}
                      onClick={() => addIdea(i)}
                    >
                      {idea.added ? "Added ✓" : "Add"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {ideas.length === 0 && !busy && !error && (
            <p className="text-sm text-gray-400">
              Ideas are tailored to this client’s business, tags, and existing content.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
