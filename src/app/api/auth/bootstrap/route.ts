import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, adminEmails, isAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * Grants the admin custom claim to whitelisted emails (ADMIN_EMAILS) on first login.
 * Called by the client when a signed-in user has no role claim yet.
 */
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }

  const authz = req.headers.get("authorization");
  const idToken = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing token." }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Distinguish a broken FIREBASE_SERVICE_ACCOUNT_KEY from a genuinely bad token.
    if (/JSON|parse|private key|PEM|credential/i.test(msg)) {
      console.error("Service account key problem:", err);
      return NextResponse.json(
        { error: `FIREBASE_SERVICE_ACCOUNT_KEY appears invalid: ${msg}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: `Invalid token: ${msg}` }, { status: 401 });
  }

  if (decoded.role) {
    return NextResponse.json({ role: decoded.role });
  }

  const email = decoded.email?.toLowerCase();
  const whitelist = adminEmails();
  if (!email || !whitelist.includes(email)) {
    return NextResponse.json(
      {
        error: `"${email}" is not in ADMIN_EMAILS (${whitelist.length} email${whitelist.length === 1 ? "" : "s"} configured).`,
      },
      { status: 403 }
    );
  }

  try {
    await adminAuth().setCustomUserClaims(decoded.uid, { role: "admin", clientId: null });
  } catch (err) {
    console.error("setCustomUserClaims failed:", err);
    return NextResponse.json(
      { error: `Setting admin role failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  try {
    await adminDb().collection("portalUsers").doc(decoded.uid).set(
      {
        email,
        displayName: decoded.name ?? email,
        role: "admin",
        clientId: null,
        isOwner: false,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("portalUsers write failed:", err);
    return NextResponse.json(
      { error: `Writing your admin profile failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ role: "admin" });
}
