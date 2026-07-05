import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const INVITE_TTL_DAYS = 14;

/** Creates a teammate invite. Caller must be an admin, or a member of the target client. */
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }

  const authz = req.headers.get("authorization");
  const idToken = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Missing token." }, { status: 401 });

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  let body: { email?: string; clientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const clientId =
    decoded.role === "admin" ? body.clientId : (decoded.clientId as string | undefined);

  if (!email || !clientId) {
    return NextResponse.json({ error: "Email and client are required." }, { status: 400 });
  }
  if (decoded.role !== "admin" && decoded.clientId !== clientId) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const db = adminDb();
  const ref = await db.collection("invites").add({
    clientId,
    email,
    invitedBy: decoded.uid,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 86400000),
  });

  return NextResponse.json({ inviteId: ref.id });
}
