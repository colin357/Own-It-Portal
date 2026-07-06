import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/serverAuth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runMigration } = require("@/lib/migrationCore.js");

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Runs the legacy-data migration in the cloud using the deployment's own
 * service account — no local setup needed. Admin-only.
 *
 * POST /api/admin/migrate            -> dry run (writes nothing)
 * POST /api/admin/migrate?commit=true -> performs the migration
 */
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  }

  const decoded = await verifyRequest(req);
  if (!decoded) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (decoded.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const commit = new URL(req.url).searchParams.get("commit") === "true";
  const defaultBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.STORAGE_BUCKET ||
    "";

  const logs: string[] = [];
  try {
    const stats = await runMigration({
      db: adminDb(),
      auth: adminAuth(),
      storage: defaultBucket ? getStorage() : null,
      defaultBucket,
      commit,
      log: (msg: string) => logs.push(msg),
    });
    return NextResponse.json({ mode: commit ? "commit" : "dry-run", stats, logs });
  } catch (err) {
    console.error("Migration failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Migration failed.",
        logs,
      },
      { status: 500 }
    );
  }
}
