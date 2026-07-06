import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { createLegacyToken, legacyModeEnabled } from "@/lib/legacyAuth";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY login that checks credentials against the old portal's Firestore
 * docs (adminUsers, users) — the pre-launch "working system". Only active
 * when NEXT_PUBLIC_LEGACY_AUTH=true.
 */
export async function POST(req: Request) {
  if (!legacyModeEnabled()) {
    return NextResponse.json({ error: "Legacy login is disabled." }, { status: 404 });
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured (missing FIREBASE_SERVICE_ACCOUNT_KEY)." },
      { status: 503 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  let db;
  try {
    db = adminDb();
    // Cheap connectivity probe so credential/parse problems surface as a clear message.
    await db.collection("adminUsers").limit(1).get();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("legacy-login: Firebase admin init failed:", err);
    return NextResponse.json(
      {
        error: `Server-side Firebase setup failed: ${msg}. Check that FIREBASE_SERVICE_ACCOUNT_KEY in Vercel is the complete service-account JSON (or its base64), with no extra quotes or truncation.`,
      },
      { status: 500 }
    );
  }

  // Admins first, then client users — same as the old portal.
  const adminsSnap = await db.collection("adminUsers").get();
  for (const doc of adminsSnap.docs) {
    const a = doc.data();
    if (a.email?.trim().toLowerCase() === email && a.password === password) {
      const token = createLegacyToken({
        uid: `legacy-admin-${doc.id}`,
        role: "admin",
        clientId: null,
        email,
        displayName: a.name ?? email,
      });
      return NextResponse.json({
        token,
        profile: { role: "admin", clientId: null, email, displayName: a.name ?? email },
      });
    }
  }

  const usersSnap = await db.collection("users").get();
  for (const doc of usersSnap.docs) {
    const u = doc.data();
    if (u.email?.trim().toLowerCase() !== email) continue;
    if (!u.password) {
      return NextResponse.json(
        { error: "This account's password was moved to the new login system." },
        { status: 409 }
      );
    }
    if (u.password !== password) break;
    const displayName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || email;
    const token = createLegacyToken({
      uid: `legacy-user-${doc.id}`,
      role: "client",
      clientId: doc.id, // migrated clients keep the same doc id
      email,
      displayName,
    });
    return NextResponse.json({
      token,
      profile: { role: "client", clientId: doc.id, email, displayName },
    });
  }

  return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
}
