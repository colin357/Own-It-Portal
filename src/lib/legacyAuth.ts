// TEMPORARY legacy auth (pre-launch): sessions verified against Firestore
// users/adminUsers docs instead of Firebase Authentication.
// Enabled with NEXT_PUBLIC_LEGACY_AUTH=true; remove before go-live.

import { createHmac, timingSafeEqual } from "crypto";

export interface LegacySession {
  uid: string;
  role: "admin" | "client";
  clientId: string | null;
  email: string;
  displayName: string;
  exp: number; // epoch ms
}

export function legacyModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LEGACY_AUTH === "true";
}

function secret(): string {
  return (
    process.env.LEGACY_SESSION_SECRET ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    "own-it-portal-dev-secret"
  );
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createLegacyToken(session: Omit<LegacySession, "exp">): string {
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp: Date.now() + 30 * 86400000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyLegacyToken(token: string): LegacySession | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as LegacySession;
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
