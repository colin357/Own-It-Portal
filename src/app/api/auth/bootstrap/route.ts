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
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  if (decoded.role) {
    return NextResponse.json({ role: decoded.role });
  }

  const email = decoded.email?.toLowerCase();
  if (!email || !adminEmails().includes(email)) {
    return NextResponse.json({ error: "Not eligible." }, { status: 403 });
  }

  await adminAuth().setCustomUserClaims(decoded.uid, { role: "admin", clientId: null });
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

  return NextResponse.json({ role: "admin" });
}
