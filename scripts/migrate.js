#!/usr/bin/env node
/**
 * One-time migration from the old portal's Firestore collections to the new
 * portal schema (same Firebase project, new collections).
 *
 * Old -> New:
 *   groups                     -> tags
 *   users                      -> clients + portalUsers + Firebase Auth (+ onboarding tasks)
 *   adminUsers                 -> portalUsers (role admin) + Firebase Auth
 *   content                    -> contentItems
 *   calendarEvents             -> contentItems.scheduledDate (or new contentItems)
 *   videos                     -> Storage copies under portal/{clientId}/uploads/
 *   adminActivities, dailyTasks, dailyTaskCompletions -> intentionally NOT migrated
 *
 * Usage:
 *   node scripts/migrate.js            # DRY RUN: prints what would happen, writes nothing
 *   node scripts/migrate.js --commit   # actually performs the migration
 *
 * Credentials (either):
 *   FIREBASE_SERVICE_ACCOUNT_KEY  base64 or raw JSON of a service account key
 *   ./service-account.json        key file next to package.json
 *
 * Every migrated doc keeps a `legacyId` field, and new doc IDs are derived from
 * old ones, so re-running updates in place instead of duplicating.
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");

const COMMIT = process.argv.includes("--commit");

// ---------- setup ----------

function loadCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    return JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  }
  const file = path.join(process.cwd(), "service-account.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  console.error(
    "No credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or place service-account.json in the project root."
  );
  process.exit(1);
}

const serviceAccount = loadCredentials();
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`,
});
const db = admin.firestore();
const auth = admin.auth();

const stats = {};
function count(key) {
  stats[key] = (stats[key] ?? 0) + 1;
}
function log(msg) {
  console.log(`${COMMIT ? "" : "[dry-run] "}${msg}`);
}

function ts(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

async function setDoc(ref, data, label) {
  count(label);
  if (COMMIT) await ref.set(data, { merge: true });
}

// ---------- auth helpers ----------

async function ensureAuthUser({ email, password, displayName }) {
  const normalized = email.trim().toLowerCase();
  try {
    const existing = await auth.getUserByEmail(normalized);
    return { uid: existing.uid, created: false };
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
  }
  if (!COMMIT) return { uid: `dryrun-${normalized}`, created: true };
  const user = await auth.createUser({
    email: normalized,
    password: password && password.length >= 6 ? password : undefined,
    displayName,
  });
  return { uid: user.uid, created: true };
}

// ---------- migration steps ----------

async function migrateTags() {
  const snap = await db.collection("groups").get();
  const tagIdByGroupId = {};
  for (const doc of snap.docs) {
    const g = doc.data();
    const tagRef = db.collection("tags").doc(`legacy-${doc.id}`);
    await setDoc(tagRef, { name: g.name ?? "Untitled group", color: "indigo", legacyId: doc.id }, "tags");
    tagIdByGroupId[doc.id] = tagRef.id;
    log(`tag: "${g.name}" (from group ${doc.id})`);
  }
  return tagIdByGroupId;
}

const ONBOARDING_TASKS = [
  { key: "headshot", title: "Upload your headshot" },
  { key: "logins", title: "Provide your account logins" },
  { key: "review", title: "Leave a review" },
  { key: "video", title: "Record your intro video" },
];

function formatOnboardingNotes(u) {
  const a = u.onboardingAnswers;
  if (!a) return "";
  const list = (v) => (Array.isArray(v) ? v.join(", ") : v || "");
  const lines = [
    "— Migrated onboarding answers —",
    a.industry ? `Industry: ${list(a.industry)}` : null,
    a.brandVoice ? `Brand voice: ${list(a.brandVoice)}` : null,
    a.goals ? `Goals: ${list(a.goals)}` : null,
    a.targetAudience ? `Target audience: ${list(a.targetAudience)}` : null,
    a.competitors ? `Competitors: ${list(a.competitors)}` : null,
  ].filter(Boolean);
  return lines.length > 1 ? lines.join("\n") : "";
}

async function migrateClients(tagIdByGroupId) {
  const snap = await db.collection("users").get();
  const clientIdByLegacyId = {};

  for (const doc of snap.docs) {
    const u = doc.data();
    if (!u.email) {
      log(`SKIP user ${doc.id}: no email`);
      count("users-skipped");
      continue;
    }
    const clientRef = db.collection("clients").doc(doc.id); // keep legacy id as the client id
    clientIdByLegacyId[doc.id] = clientRef.id;
    const tagIds = u.groupId && tagIdByGroupId[u.groupId] ? [tagIdByGroupId[u.groupId]] : [];

    await setDoc(
      clientRef,
      {
        name: u.companyName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email,
        status: u.onboarded ? "active" : "onboarding",
        tagIds,
        notes: formatOnboardingNotes(u),
        phone: null,
        ownerUid: "", // set below once the auth user exists
        createdAt: ts(u.createdAt) ?? FieldValue.serverTimestamp(),
        legacyId: doc.id,
      },
      "clients"
    );

    const displayName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
    const { uid, created } = await ensureAuthUser({
      email: u.email,
      password: u.password,
      displayName,
    });
    log(`client: "${u.companyName}" owner ${u.email} (auth ${created ? "created" : "exists"})`);

    if (COMMIT) {
      await auth.setCustomUserClaims(uid, { role: "client", clientId: clientRef.id });
      await clientRef.set({ ownerUid: uid }, { merge: true });
    }
    await setDoc(
      db.collection("portalUsers").doc(uid),
      {
        email: u.email.trim().toLowerCase(),
        displayName,
        role: "client",
        clientId: clientRef.id,
        isOwner: true,
        createdAt: ts(u.createdAt) ?? FieldValue.serverTimestamp(),
        legacyId: doc.id,
      },
      "portalUsers"
    );

    // Onboarding progress -> real tasks, done/open by old completion flags.
    const completed = u.onboardingTasksCompleted ?? {};
    for (let i = 0; i < ONBOARDING_TASKS.length; i++) {
      const t = ONBOARDING_TASKS[i];
      const done = completed[t.key] === true;
      await setDoc(
        db.collection("tasks").doc(`legacy-${doc.id}-onb-${t.key}`),
        {
          clientId: clientRef.id,
          title: t.title,
          description: "",
          status: done ? "done" : "todo",
          priority: "medium",
          dueDate: null,
          videoUrl: null,
          attachments: [],
          createdBy: { uid: "migration", role: "admin" },
          assignedTo: "client",
          templateId: null,
          order: i,
          createdAt: ts(u.createdAt) ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          completedAt: done ? FieldValue.serverTimestamp() : null,
          legacyId: `${doc.id}-onb-${t.key}`,
        },
        done ? "onboarding-tasks-done" : "onboarding-tasks-open"
      );
    }

    // Remove the plaintext password from the old doc.
    if (COMMIT && u.password) {
      await doc.ref.update({ password: FieldValue.delete() });
      count("passwords-scrubbed");
    }
  }
  return clientIdByLegacyId;
}

async function migrateAdmins() {
  const snap = await db.collection("adminUsers").get();
  for (const doc of snap.docs) {
    const a = doc.data();
    if (!a.email) continue;
    const { uid, created } = await ensureAuthUser({
      email: a.email,
      password: a.password,
      displayName: a.name,
    });
    log(`admin: ${a.email} (auth ${created ? "created" : "exists"})`);
    if (COMMIT) await auth.setCustomUserClaims(uid, { role: "admin", clientId: null });
    await setDoc(
      db.collection("portalUsers").doc(uid),
      {
        email: a.email.trim().toLowerCase(),
        displayName: a.name ?? a.email,
        role: "admin",
        clientId: null,
        isOwner: false,
        createdAt: ts(a.createdAt) ?? FieldValue.serverTimestamp(),
        legacyId: doc.id,
      },
      "admins"
    );
    if (COMMIT && a.password) {
      await doc.ref.update({ password: FieldValue.delete() });
      count("passwords-scrubbed");
    }
  }
}

const CONTENT_TYPE_MAP = {
  "content-idea": "idea",
  idea: "idea",
  social: "social_post",
  "social-post": "social_post",
  email: "email_blast",
  "email-blast": "email_blast",
  blog: "blog_post",
  "blog-post": "blog_post",
};

const CONTENT_STATUS_MAP = {
  pending: "idea",
  approved: "draft",
  draft: "draft",
  scheduled: "scheduled",
  completed: "published",
  published: "published",
};

async function migrateContent(clientIdByLegacyId) {
  const snap = await db.collection("content").get();
  const contentRefByLegacyId = {};
  for (const doc of snap.docs) {
    const c = doc.data();
    const clientId = clientIdByLegacyId[c.clientId];
    if (!clientId) {
      log(`SKIP content ${doc.id}: unknown clientId ${c.clientId}`);
      count("content-skipped");
      continue;
    }
    const ref = db.collection("contentItems").doc(`legacy-${doc.id}`);
    contentRefByLegacyId[doc.id] = ref;
    const body = [c.content, c.description].filter(Boolean).join("\n\n");
    await setDoc(
      ref,
      {
        clientId,
        type: CONTENT_TYPE_MAP[c.type] ?? "idea",
        title: c.title ?? "Untitled",
        body,
        status: CONTENT_STATUS_MAP[c.status] ?? "idea",
        scheduledDate: null, // calendarEvents fill this in below
        link: null,
        attachments: [],
        createdBy: { uid: "migration", role: "admin" },
        createdAt: ts(c.createdAt) ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        legacyId: doc.id,
      },
      "contentItems"
    );
  }
  log(`content: ${snap.size} docs processed`);
  return contentRefByLegacyId;
}

async function migrateCalendarEvents(clientIdByLegacyId, contentRefByLegacyId) {
  const snap = await db.collection("calendarEvents").get();
  for (const doc of snap.docs) {
    const e = doc.data();
    const when = e.date ? ts(`${e.date}T12:00:00Z`) : ts(e.createdAt);

    const target = e.contentId ? contentRefByLegacyId[e.contentId] : null;
    if (target) {
      count("calendar-scheduled");
      if (COMMIT && when) {
        await target.set({ scheduledDate: when, status: "scheduled" }, { merge: true });
      }
      continue;
    }

    const clientId = clientIdByLegacyId[e.clientId];
    if (!clientId) {
      log(`SKIP calendarEvent ${doc.id}: unknown clientId ${e.clientId}`);
      count("calendar-skipped");
      continue;
    }
    await setDoc(
      db.collection("contentItems").doc(`legacy-evt-${doc.id}`),
      {
        clientId,
        type: CONTENT_TYPE_MAP[e.type] ?? "social_post",
        title: e.title ?? "Untitled",
        body: e.description ?? "",
        status: "scheduled",
        scheduledDate: when,
        link: null,
        attachments: [],
        createdBy: { uid: "migration", role: "admin" },
        createdAt: ts(e.createdAt) ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        legacyId: doc.id,
      },
      "calendar-standalone"
    );
  }
  log(`calendarEvents: ${snap.size} docs processed`);
}

function storagePathFromUrl(url) {
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<url-encoded path>?...
  const m = url?.match(/\/b\/([^/]+)\/o\/([^?]+)/);
  if (!m) return null;
  return { bucket: m[1], objectPath: decodeURIComponent(m[2]) };
}

async function migrateVideos(clientIdByLegacyId) {
  const snap = await db.collection("videos").get();
  for (const doc of snap.docs) {
    const v = doc.data();
    const clientId = clientIdByLegacyId[v.clientId];
    if (!clientId) {
      log(`SKIP video ${doc.id}: unknown clientId ${v.clientId}`);
      count("videos-skipped");
      continue;
    }
    const parsed = storagePathFromUrl(v.videoLink);
    if (!parsed) {
      log(`SKIP video ${doc.id}: unparseable videoLink`);
      count("videos-skipped");
      continue;
    }
    const destPath = `portal/${clientId}/uploads/${v.fileName ?? path.basename(parsed.objectPath)}`;
    count("videos-copied");
    log(`video: ${parsed.objectPath} -> ${destPath}`);
    if (COMMIT) {
      const bucket = admin.storage().bucket(parsed.bucket);
      const src = bucket.file(parsed.objectPath);
      const [exists] = await src.exists();
      if (!exists) {
        log(`  WARN source object missing, skipped`);
        stats["videos-copied"]--;
        count("videos-missing");
        continue;
      }
      await src.copy(admin.storage().bucket().file(destPath));
    }
  }
  log(`videos: ${snap.size} docs processed`);
}

// ---------- main ----------

(async () => {
  console.log(
    COMMIT
      ? "=== MIGRATION (COMMIT MODE — writing data) ==="
      : "=== MIGRATION DRY RUN (no writes; pass --commit to apply) ==="
  );
  const tagIdByGroupId = await migrateTags();
  const clientIdByLegacyId = await migrateClients(tagIdByGroupId);
  await migrateAdmins();
  const contentRefByLegacyId = await migrateContent(clientIdByLegacyId);
  await migrateCalendarEvents(clientIdByLegacyId, contentRefByLegacyId);
  await migrateVideos(clientIdByLegacyId);

  console.log("\n=== Summary ===");
  for (const [k, v] of Object.entries(stats).sort()) console.log(`  ${k}: ${v}`);
  console.log(
    COMMIT
      ? "\nDone. Spot-check a client login and the admin dashboard, then you're set."
      : "\nDry run complete. Re-run with --commit to apply."
  );
  process.exit(0);
})().catch((err) => {
  console.error("\nMigration failed:", err);
  process.exit(1);
});
