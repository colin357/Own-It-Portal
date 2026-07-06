"use client";

import { useEffect, useState, type FormEvent } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useDoc } from "@/lib/firestore/hooks";
import { Button, Input, Label } from "@/components/ui";
import type { Client } from "@/lib/types";

export function SmsSettings({ clientId }: { clientId: string }) {
  const { data: client } = useDoc<Client>(`clients/${clientId}`);
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPhone(client?.phone ?? "");
  }, [client?.phone]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await updateDoc(doc(db(), "clients", clientId), { phone: phone.trim() || null });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Text reminders</h2>
      <p className="mb-3 text-sm text-gray-500">
        Add a mobile number to get a text when tasks are due soon or overdue. Leave it
        blank to turn reminders off.
      </p>
      <form onSubmit={save} className="flex items-end gap-3">
        <div className="max-w-xs flex-1">
          <Label htmlFor="sms-phone">Mobile number</Label>
          <Input
            id="sms-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {saved ? "Saved!" : busy ? "Saving…" : "Save"}
        </Button>
      </form>
    </section>
  );
}
