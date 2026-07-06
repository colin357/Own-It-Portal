import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/serverAuth";
import { isTwilioConfigured, normalizePhone, sendSms } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const INVITE_TTL_DAYS = 14;

/** Creates a teammate invite. Caller must be an admin, or a member of the target client. */
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }

  const decoded = await verifyRequest(req);
  if (!decoded) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { email?: string; clientId?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const clientId = decoded.role === "admin" ? body.clientId : decoded.clientId ?? undefined;

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

  // Optionally text the invite link to the teammate.
  let smsSent = false;
  if (body.phone && isTwilioConfigured()) {
    const phone = normalizePhone(body.phone);
    if (phone) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
      try {
        await sendSms(
          phone,
          `You've been invited to the Own It Social client portal. Set up your login here: ${appUrl}/join/${ref.id}`
        );
        smsSent = true;
      } catch (err) {
        console.error("Invite SMS failed:", err);
      }
    }
  }

  return NextResponse.json({ inviteId: ref.id, smsSent });
}
