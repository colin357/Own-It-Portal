import type { ContentStatus, ContentType } from "@/lib/types";
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS } from "@/lib/types";

/** Hard cap on how many items one bulk request may create. */
export const BULK_MAX_ITEMS = 1000;

/** A single content idea, before a client has been resolved and it's written. */
export interface RawBulkItem {
  clientId?: string;
  clientName?: string;
  title?: string;
  body?: string;
  type?: string;
  status?: string;
  scheduledDate?: string;
  link?: string;
}

/** A validated item ready to persist, with the client resolved to an id. */
export interface NormalizedBulkItem {
  clientId: string;
  title: string;
  body: string;
  type: ContentType;
  status: ContentStatus;
  /** YYYY-MM-DD or null. Kept as a string so callers build the Timestamp. */
  scheduledDate: string | null;
  link: string | null;
}

export interface BulkItemError {
  index: number;
  reason: string;
}

function isContentType(v: string): v is ContentType {
  return Object.prototype.hasOwnProperty.call(CONTENT_TYPE_LABELS, v);
}

function isContentStatus(v: string): v is ContentStatus {
  return Object.prototype.hasOwnProperty.call(CONTENT_STATUS_LABELS, v);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Flattens a bulk payload into a single list of raw items. Supports two shapes:
 *
 *   { items: [ { clientName, title, ... }, ... ] }
 *
 *   { clients: [ { clientName, ideas: [ { title, ... } ] }, ... ] }
 *
 * Top-level `type`, `status`, `clientId`, and `clientName` act as defaults that
 * each item (or client group) inherits unless it sets its own.
 */
export function flattenBulkPayload(payload: unknown): RawBulkItem[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;

  const defaults: Partial<RawBulkItem> = {
    clientId: typeof p.clientId === "string" ? p.clientId : undefined,
    clientName: typeof p.clientName === "string" ? p.clientName : undefined,
    type: typeof p.type === "string" ? p.type : undefined,
    status: typeof p.status === "string" ? p.status : undefined,
  };

  const out: RawBulkItem[] = [];

  const pushItem = (raw: unknown, group?: Partial<RawBulkItem>) => {
    if (!raw || typeof raw !== "object") {
      out.push({});
      return;
    }
    const r = raw as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    out.push({
      clientId: str(r.clientId) ?? group?.clientId ?? defaults.clientId,
      clientName: str(r.clientName) ?? group?.clientName ?? defaults.clientName,
      title: str(r.title),
      body: str(r.body) ?? str(r.description),
      type: str(r.type) ?? group?.type ?? defaults.type,
      status: str(r.status) ?? group?.status ?? defaults.status,
      scheduledDate: str(r.scheduledDate) ?? str(r.date),
      link: str(r.link) ?? str(r.url),
    });
  };

  if (Array.isArray(p.items)) {
    for (const raw of p.items) pushItem(raw);
  }

  if (Array.isArray(p.clients)) {
    for (const c of p.clients) {
      if (!c || typeof c !== "object") continue;
      const cr = c as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v : undefined);
      const group: Partial<RawBulkItem> = {
        clientId: str(cr.clientId) ?? defaults.clientId,
        clientName: str(cr.clientName) ?? defaults.clientName,
        type: str(cr.type) ?? defaults.type,
        status: str(cr.status) ?? defaults.status,
      };
      const ideas = Array.isArray(cr.ideas)
        ? cr.ideas
        : Array.isArray(cr.items)
          ? cr.items
          : [];
      for (const raw of ideas) pushItem(raw, group);
    }
  }

  return out;
}

/**
 * Validates and normalizes raw items. `resolveClient` turns a clientId or
 * clientName into a real client id (or null if it can't be found); it's async
 * so callers can look clients up however they like (Admin SDK, client SDK…).
 *
 * Returns the items that passed and a per-index list of the ones that didn't.
 */
export async function normalizeBulkItems(
  raw: RawBulkItem[],
  resolveClient: (ref: { clientId?: string; clientName?: string }) => Promise<string | null>
): Promise<{ items: NormalizedBulkItem[]; errors: BulkItemError[] }> {
  const items: NormalizedBulkItem[] = [];
  const errors: BulkItemError[] = [];

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const title = r.title?.trim();
    if (!title) {
      errors.push({ index: i, reason: "Missing title." });
      continue;
    }

    if (!r.clientId && !r.clientName) {
      errors.push({ index: i, reason: "Missing clientId or clientName." });
      continue;
    }
    const clientId = await resolveClient({ clientId: r.clientId, clientName: r.clientName });
    if (!clientId) {
      errors.push({
        index: i,
        reason: `Could not find client "${r.clientName ?? r.clientId}".`,
      });
      continue;
    }

    const type = r.type?.trim();
    if (type && !isContentType(type)) {
      errors.push({
        index: i,
        reason: `Invalid type "${type}". Use one of: ${Object.keys(CONTENT_TYPE_LABELS).join(", ")}.`,
      });
      continue;
    }

    const status = r.status?.trim();
    if (status && !isContentStatus(status)) {
      errors.push({
        index: i,
        reason: `Invalid status "${status}". Use one of: ${Object.keys(CONTENT_STATUS_LABELS).join(", ")}.`,
      });
      continue;
    }

    const scheduledDate = r.scheduledDate?.trim();
    if (scheduledDate && !DATE_RE.test(scheduledDate)) {
      errors.push({ index: i, reason: `Invalid scheduledDate "${scheduledDate}". Use YYYY-MM-DD.` });
      continue;
    }

    items.push({
      clientId,
      title: title.slice(0, 200),
      body: (r.body ?? "").trim().slice(0, 5000),
      type: (type as ContentType) ?? "idea",
      status: (status as ContentStatus) ?? "idea",
      scheduledDate: scheduledDate || null,
      link: r.link?.trim() || null,
    });
  }

  return { items, errors };
}
