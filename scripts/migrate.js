#!/usr/bin/env node
/**
 * CLI wrapper for the old-portal -> new-portal migration.
 * All the logic lives in src/lib/migrationCore.js (shared with /api/admin/migrate).
 *
 * Usage:
 *   node scripts/migrate.js            # DRY RUN: prints what would happen, writes nothing
 *   node scripts/migrate.js --commit   # actually performs the migration
 *
 * Credentials (either):
 *   FIREBASE_SERVICE_ACCOUNT_KEY  base64 or raw JSON of a service account key
 *   ./service-account.json        key file next to package.json
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { runMigration } = require("../src/lib/migrationCore.js");

const COMMIT = process.argv.includes("--commit");

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

(async () => {
  const serviceAccount = loadCredentials();
  const defaultBucket =
    process.env.STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`;
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  console.log(
    COMMIT
      ? "=== MIGRATION (COMMIT MODE — writing data) ==="
      : "=== MIGRATION DRY RUN (no writes; pass --commit to apply) ==="
  );

  const stats = await runMigration({
    db: admin.firestore(),
    auth: admin.auth(),
    storage: admin.storage(),
    defaultBucket,
    commit: COMMIT,
    log: (msg) => console.log(`${COMMIT ? "" : "[dry-run] "}${msg}`),
  });

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
