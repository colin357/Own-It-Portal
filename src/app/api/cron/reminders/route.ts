import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { isTwilioConfigured, sendSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const MIN_HOURS_BETWEEN_REMINDERS = 20;

/**
 * Daily task-reminder job (wired up in vercel.json).
 * Texts each client whose org has tasks that are overdue or due within 24 hours.
 * Protected by Vercel's CRON_SECRET when set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Firebase admin not configured." }, { status: 503 });
  }
  if (!isTwilioConfigured()) {
    return NextResponse.json({ error: "Twilio not configured." }, { status: 503 });
  }

  const db = adminDb();
  const now = Date.now();
  const cutoff = Timestamp.fromMillis(now + 24 * 3600000);

  // Open client-facing tasks due within 24h (or already overdue).
  const snap = await db
    .collection("tasks")
    .where("dueDate", "<=", cutoff)
    .get();

  const byClient = new Map<string, { overdue: number; dueSoon: number }>();
  for (const doc of snap.docs) {
    const t = doc.data();
    if (t.status === "done" || t.assignedTo !== "client" || !t.dueDate) continue;
    const entry = byClient.get(t.clientId) ?? { overdue: 0, dueSoon: 0 };
    if (t.dueDate.toMillis() < now) entry.overdue++;
    else entry.dueSoon++;
    byClient.set(t.clientId, entry);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const results: { clientId: string; sent: boolean; reason?: string }[] = [];

  for (const [clientId, counts] of Array.from(byClient.entries())) {
    const clientSnap = await db.collection("clients").doc(clientId).get();
    const client = clientSnap.data();
    if (!client) continue;
    if (!client.phone) {
      results.push({ clientId, sent: false, reason: "no phone on file" });
      continue;
    }
    if (client.status === "archived") {
      results.push({ clientId, sent: false, reason: "archived" });
      continue;
    }
    const last = client.lastTaskReminderAt?.toMillis?.() ?? 0;
    if (now - last < MIN_HOURS_BETWEEN_REMINDERS * 3600000) {
      results.push({ clientId, sent: false, reason: "recently reminded" });
      continue;
    }

    const parts: string[] = [];
    if (counts.overdue) parts.push(`${counts.overdue} overdue task${counts.overdue > 1 ? "s" : ""}`);
    if (counts.dueSoon) parts.push(`${counts.dueSoon} task${counts.dueSoon > 1 ? "s" : ""} due in the next day`);
    const body = `Own It Social: You have ${parts.join(" and ")} in your client portal. Log in to take a look: ${appUrl}/portal`;

    try {
      await sendSms(client.phone, body);
      await clientSnap.ref.update({ lastTaskReminderAt: Timestamp.fromMillis(now) });
      results.push({ clientId, sent: true });
    } catch (err) {
      console.error(`Reminder SMS failed for client ${clientId}:`, err);
      results.push({ clientId, sent: false, reason: "twilio error" });
    }
  }

  return NextResponse.json({
    checked: byClient.size,
    sent: results.filter((r) => r.sent).length,
    results,
  });
}
