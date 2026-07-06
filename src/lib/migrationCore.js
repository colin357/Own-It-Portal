/**
 * Shared migration logic: old portal collections -> new portal schema.
 * Used by both scripts/migrate.js (CLI) and /api/admin/migrate (cloud).
 *
 * Old -> New:
 *   groups         -> tags
 *   users          -> clients + portalUsers + Firebase Auth (+ onboarding tasks)
 *   adminUsers     -> portalUsers (role admin) + Firebase Auth
 *   content        -> contentItems
 *   calendarEvents -> contentItems.scheduledDate (or new contentItems)
 *   videos         -> Storage copies under portal/{clientId}/uploads/
 *   adminActivities, dailyTasks, dailyTaskCompletions -> intentionally NOT migrated
 *
 * Copy-only, except plaintext `password` fields are deleted from users/adminUsers
 * after Auth accounts exist. Deterministic legacy-derived IDs make re-runs
 * update in place instead of duplicating.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Timestamp, FieldValue } = require("firebase-admin/firestore");

const ONBOARDING_TASKS = [
  { key: "headshot", title: "Upload your headshot" },
  { key: "logins", title: "Provide your account logins" },
  { key: "review", title: "Leave a review" },
  { key: "video", title: "Record your intro video" },
];

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

function ts(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

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

function storagePathFromUrl(url) {
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<url-encoded path>?...
  const m = url && url.match(/\/b\/([^/]+)\/o\/([^?]+)/);
  if (!m) return null;
  return { bucket: m[1], objectPath: decodeURIComponent(m[2]) };
}

/**
 * @param deps.db      firebase-admin Firestore
 * @param deps.auth    firebase-admin Auth
 * @param deps.storage firebase-admin Storage (or null to skip video copying)
 * @param deps.defaultBucket  destination bucket name for video copies
 * @param deps.commit  false = dry run
 * @param deps.log     (message: string) => void
 * @returns stats object
 */
async function runMigration({ db, auth, storage, defaultBucket, commit, log }) {
  const stats = {};
  const count = (key) => {
    stats[key] = (stats[key] ?? 0) + 1;
  };

  async function setDoc(ref, data, label) {
    count(label);
    if (commit) await ref.set(data, { merge: true });
  }

  async function ensureAuthUser({ email, password, displayName }) {
    const normalized = email.trim().toLowerCase();
    try {
      const existing = await auth.getUserByEmail(normalized);
      return { uid: existing.uid, created: false };
    } catch (err) {
      if (err.code !== "auth/user-not-found") throw err;
    }
    if (!commit) return { uid: `dryrun-${normalized}`, created: true };
    const user = await auth.createUser({
      email: normalized,
      password: password && password.length >= 6 ? password : undefined,
      displayName,
    });
    return { uid: user.uid, created: true };
  }

  // ----- groups -> tags -----
  const groupsSnap = await db.collection("groups").get();
  const tagIdByGroupId = {};
  for (const doc of groupsSnap.docs) {
    const g = doc.data();
    const tagRef = db.collection("tags").doc(`legacy-${doc.id}`);
    await setDoc(tagRef, { name: g.name ?? "Untitled group", color: "indigo", legacyId: doc.id }, "tags");
    tagIdByGroupId[doc.id] = tagRef.id;
    log(`tag: "${g.name}" (from group ${doc.id})`);
  }

  // ----- users -> clients + portalUsers + auth + onboarding tasks -----
  const usersSnap = await db.collection("users").get();
  const clientIdByLegacyId = {};
  for (const doc of usersSnap.docs) {
    const u = doc.data();
    if (!u.email) {
      log(`SKIP user ${doc.id}: no email`);
      count("users-skipped");
      continue;
    }
    const clientRef = db.collection("clients").doc(doc.id);
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
        ownerUid: "",
        createdAt: ts(u.createdAt) ?? FieldValue.serverTimestamp(),
        legacyId: doc.id,
      },
      "clients"
    );

    const displayName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email;
    let uid;
    let authOk = false;
    try {
      const res = await ensureAuthUser({ email: u.email, password: u.password, displayName });
      uid = res.uid;
      authOk = true;
      log(`client: "${u.companyName}" owner ${u.email} (auth ${res.created ? "created" : "exists"})`);
    } catch (err) {
      // Firebase Auth unavailable (e.g. legacy-auth period) — keep a
      // Firestore-only identity; password stays on the old doc for legacy login.
      uid = `legacy-${doc.id}`;
      count("auth-failures");
      log(`client: "${u.companyName}" owner ${u.email} (WARN auth failed: ${err.message} — Firestore-only)`);
    }

    if (commit) {
      if (authOk) {
        await auth.setCustomUserClaims(uid, { role: "client", clientId: clientRef.id });
      }
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

    // Only remove the plaintext password once a real Auth login exists.
    if (commit && u.password && authOk) {
      await doc.ref.update({ password: FieldValue.delete() });
      count("passwords-scrubbed");
    }
  }

  // ----- adminUsers -> portalUsers (admin) + auth -----
  const adminsSnap = await db.collection("adminUsers").get();
  for (const doc of adminsSnap.docs) {
    const a = doc.data();
    if (!a.email) continue;
    let uid;
    let authOk = false;
    try {
      const res = await ensureAuthUser({ email: a.email, password: a.password, displayName: a.name });
      uid = res.uid;
      authOk = true;
      log(`admin: ${a.email} (auth ${res.created ? "created" : "exists"})`);
    } catch (err) {
      uid = `legacy-admin-${doc.id}`;
      count("auth-failures");
      log(`admin: ${a.email} (WARN auth failed: ${err.message} — Firestore-only)`);
    }
    if (commit && authOk) await auth.setCustomUserClaims(uid, { role: "admin", clientId: null });
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
    if (commit && a.password && authOk) {
      await doc.ref.update({ password: FieldValue.delete() });
      count("passwords-scrubbed");
    }
  }

  // ----- content -> contentItems -----
  const contentSnap = await db.collection("content").get();
  const contentRefByLegacyId = {};
  for (const doc of contentSnap.docs) {
    const c = doc.data();
    const clientId = clientIdByLegacyId[c.clientId];
    if (!clientId) {
      log(`SKIP content ${doc.id}: unknown clientId ${c.clientId}`);
      count("content-skipped");
      continue;
    }
    const ref = db.collection("contentItems").doc(`legacy-${doc.id}`);
    contentRefByLegacyId[doc.id] = ref;
    await setDoc(
      ref,
      {
        clientId,
        type: CONTENT_TYPE_MAP[c.type] ?? "idea",
        title: c.title ?? "Untitled",
        body: [c.content, c.description].filter(Boolean).join("\n\n"),
        status: CONTENT_STATUS_MAP[c.status] ?? "idea",
        scheduledDate: null,
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
  log(`content: ${contentSnap.size} docs processed`);

  // ----- calendarEvents -> scheduledDate / new contentItems -----
  const eventsSnap = await db.collection("calendarEvents").get();
  for (const doc of eventsSnap.docs) {
    const e = doc.data();
    const when = e.date ? ts(`${e.date}T12:00:00Z`) : ts(e.createdAt);

    const target = e.contentId ? contentRefByLegacyId[e.contentId] : null;
    if (target) {
      count("calendar-scheduled");
      if (commit && when) {
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
  log(`calendarEvents: ${eventsSnap.size} docs processed`);

  // ----- videos -> Storage copies -----
  const videosSnap = await db.collection("videos").get();
  for (const doc of videosSnap.docs) {
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
    const fileName = v.fileName || parsed.objectPath.split("/").pop();
    const destPath = `portal/${clientId}/uploads/${fileName}`;
    count("videos-copied");
    log(`video: ${parsed.objectPath} -> ${destPath}`);
    if (commit && storage) {
      const src = storage.bucket(parsed.bucket).file(parsed.objectPath);
      const [exists] = await src.exists();
      if (!exists) {
        log(`  WARN source object missing, skipped`);
        stats["videos-copied"]--;
        count("videos-missing");
        continue;
      }
      await src.copy(storage.bucket(defaultBucket).file(destPath));
    }
  }
  log(`videos: ${videosSnap.size} docs processed`);

  return stats;
}

module.exports = { runMigration };
