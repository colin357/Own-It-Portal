import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import {
  BULK_MAX_ITEMS,
  flattenBulkPayload,
  normalizeBulkItems,
} from "@/lib/bulkContent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Firestore caps a single batched write at 500 operations.
const BATCH_LIMIT = 500;

/**
 * Bulk-creates content items (e.g. a week's worth of ideas for many clients)
 * in one request. Built for automation: run it from a script, a spreadsheet
 * export, Zapier/Make, etc. instead of adding ideas one at a time in the UI.
 *
 * This endpoint is intentionally unauthenticated — anyone who can reach the URL
 * can create content ideas. It only ever creates `contentItems` (no reads,
 * updates, or deletes) and is capped per request.
 *
 * Body (see src/lib/bulkContent.ts for the full shape). Simplest form:
 *   {
 *     "type": "idea",                       // optional default for every item
 *     "items": [
 *       { "clientName": "Joe's Plumbing",
 *         "title": "5 signs your water heater is failing",
 *         "body": "Educational post; end with a service CTA.",
 *         "scheduledDate": "2026-07-20" }
 *     ]
 *   }
 *
 * Clients can be referenced by "clientId" or by "clientName" (case-insensitive,
 * must be unique). You can also group by client:
 *   { "clients": [ { "clientName": "…", "ideas": [ … 8 items … ] } ] }
 */
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured (missing FIREBASE_SERVICE_ACCOUNT_KEY)." },
      { status: 503 }
    );
  }

  const creatorUid = "bulk-api";

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = flattenBulkPayload(payload);
  if (raw.length === 0) {
    return NextResponse.json(
      { error: "No items found. Provide an `items` or `clients` array." },
      { status: 400 }
    );
  }
  if (raw.length > BULK_MAX_ITEMS) {
    return NextResponse.json(
      { error: `Too many items (${raw.length}). The limit is ${BULK_MAX_ITEMS} per request.` },
      { status: 400 }
    );
  }

  const db = adminDb();

  // Resolve clients by name lazily, caching lookups so a week of ideas for the
  // same client only costs one query. Names are matched case-insensitively and
  // must be unique to avoid writing to the wrong client.
  const idCache = new Map<string, string | null>();
  const nameCache = new Map<string, string | null>();

  async function resolveClient(ref: {
    clientId?: string;
    clientName?: string;
  }): Promise<string | null> {
    if (ref.clientId) {
      if (!idCache.has(ref.clientId)) {
        const snap = await db.collection("clients").doc(ref.clientId).get();
        idCache.set(ref.clientId, snap.exists ? snap.id : null);
      }
      return idCache.get(ref.clientId) ?? null;
    }
    if (ref.clientName) {
      const key = ref.clientName.trim().toLowerCase();
      if (!nameCache.has(key)) {
        const snap = await db.collection("clients").get();
        const matches = snap.docs.filter(
          (d) => (d.data().name ?? "").trim().toLowerCase() === key
        );
        // Unambiguous match only; ambiguous or missing → null (reported per item).
        nameCache.set(key, matches.length === 1 ? matches[0].id : null);
        // Warm the cache for every client so repeat names don't re-scan.
        if (matches.length !== 1) {
          for (const d of snap.docs) {
            const k = (d.data().name ?? "").trim().toLowerCase();
            if (!nameCache.has(k)) {
              const uniq = snap.docs.filter(
                (x) => (x.data().name ?? "").trim().toLowerCase() === k
              );
              nameCache.set(k, uniq.length === 1 ? uniq[0].id : null);
            }
          }
        }
      }
      return nameCache.get(key) ?? null;
    }
    return null;
  }

  const { items, errors } = await normalizeBulkItems(raw, resolveClient);

  // Write what's valid in chunks that respect Firestore's 500-op batch cap.
  const byClient: Record<string, number> = {};
  for (let start = 0; start < items.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    for (const item of items.slice(start, start + BATCH_LIMIT)) {
      const ref = db.collection("contentItems").doc();
      batch.set(ref, {
        clientId: item.clientId,
        type: item.type,
        title: item.title,
        body: item.body,
        status: item.status,
        scheduledDate: item.scheduledDate
          ? Timestamp.fromDate(new Date(item.scheduledDate + "T12:00:00"))
          : null,
        link: item.link,
        attachments: [],
        createdBy: { uid: creatorUid, role: "admin" },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      byClient[item.clientId] = (byClient[item.clientId] ?? 0) + 1;
    }
    await batch.commit();
  }

  return NextResponse.json({
    created: items.length,
    skipped: errors.length,
    byClient,
    errors,
  });
}
