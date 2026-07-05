import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/** Accepts an invite: creates the secondary user under the invite's client. */
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }

  let body: { inviteId?: string; displayName?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { inviteId, displayName, password } = body;
  if (!inviteId || !displayName?.trim() || !password || password.length < 8) {
    return NextResponse.json(
      { error: "All fields are required; password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const db = adminDb();
  const auth = adminAuth();

  const inviteRef = db.collection("invites").doc(inviteId);
  const snap = await inviteRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  const invite = snap.data()!;
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "This invite is no longer valid." }, { status: 410 });
  }
  if (invite.expiresAt?.toMillis() < Date.now()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }

  let uid: string;
  try {
    const user = await auth.createUser({
      email: invite.email,
      password,
      displayName: displayName.trim(),
    });
    uid = user.uid;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "An account with this email already exists. Try logging in instead." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }

  try {
    await db.collection("portalUsers").doc(uid).set({
      email: invite.email,
      displayName: displayName.trim(),
      role: "client",
      clientId: invite.clientId,
      isOwner: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await auth.setCustomUserClaims(uid, { role: "client", clientId: invite.clientId });
    await inviteRef.update({ status: "accepted" });

    const token = await auth.createCustomToken(uid);
    return NextResponse.json({ token });
  } catch (err) {
    await auth.deleteUser(uid).catch(() => {});
    console.error("Invite acceptance failed:", err);
    return NextResponse.json({ error: "Could not set up your account." }, { status: 500 });
  }
}

/** Fetch minimal public info about an invite so the join page can render. */
export async function GET(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const inviteId = searchParams.get("inviteId");
  if (!inviteId) return NextResponse.json({ error: "Missing inviteId." }, { status: 400 });

  const snap = await adminDb().collection("invites").doc(inviteId).get();
  if (!snap.exists) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  const invite = snap.data()!;
  const valid =
    invite.status === "pending" && invite.expiresAt?.toMillis() >= Date.now();

  let clientName: string | null = null;
  if (valid) {
    const client = await adminDb().collection("clients").doc(invite.clientId).get();
    clientName = client.exists ? (client.data()!.name as string) : null;
  }

  return NextResponse.json({ valid, email: valid ? invite.email : null, clientName });
}
