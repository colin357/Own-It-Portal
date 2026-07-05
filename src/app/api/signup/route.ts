import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured (missing FIREBASE_SERVICE_ACCOUNT_KEY)." },
      { status: 503 }
    );
  }

  let body: { businessName?: string; displayName?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const businessName = body.businessName?.trim();
  const displayName = body.displayName?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!businessName || !displayName || !email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "All fields are required; password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const auth = adminAuth();
  const db = adminDb();

  let uid: string;
  try {
    const user = await auth.createUser({ email, password, displayName });
    uid = user.uid;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }

  try {
    const clientRef = db.collection("clients").doc();
    const batch = db.batch();

    batch.set(clientRef, {
      name: businessName,
      status: "onboarding",
      tagIds: [],
      ownerUid: uid,
      notes: "",
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(db.collection("portalUsers").doc(uid), {
      email,
      displayName,
      role: "client",
      clientId: clientRef.id,
      isOwner: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Auto-assign onboarding tasks from active templates.
    const templates = await db
      .collection("taskTemplates")
      .where("active", "==", true)
      .get();
    const now = Date.now();
    templates.docs
      .sort((a, b) => (a.data().order ?? 0) - (b.data().order ?? 0))
      .forEach((t, i) => {
        const tpl = t.data();
        const due =
          typeof tpl.dueOffsetDays === "number"
            ? Timestamp.fromMillis(now + tpl.dueOffsetDays * 86400000)
            : null;
        batch.set(db.collection("tasks").doc(), {
          clientId: clientRef.id,
          title: tpl.title ?? "Onboarding task",
          description: tpl.description ?? "",
          status: "todo",
          priority: tpl.priority ?? "medium",
          dueDate: due,
          videoUrl: tpl.videoUrl ?? null,
          attachments: [],
          createdBy: { uid: "system", role: "admin" },
          assignedTo: "client",
          templateId: t.id,
          order: i,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          completedAt: null,
        });
      });

    await batch.commit();
    await auth.setCustomUserClaims(uid, { role: "client", clientId: clientRef.id });

    const token = await auth.createCustomToken(uid);
    return NextResponse.json({ token, clientId: clientRef.id });
  } catch (err) {
    // Roll back the auth user so the email isn't stranded half-provisioned.
    await auth.deleteUser(uid).catch(() => {});
    console.error("Signup provisioning failed:", err);
    return NextResponse.json({ error: "Could not set up your account." }, { status: 500 });
  }
}
