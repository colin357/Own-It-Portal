"use client";

// Client-side session helpers that work in both auth modes.
// Legacy mode (NEXT_PUBLIC_LEGACY_AUTH=true) stores a signed session token in
// localStorage; normal mode uses Firebase Auth.

import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

export const isLegacyMode = process.env.NEXT_PUBLIC_LEGACY_AUTH === "true";

const KEY = "ownit-legacy-session";

export interface LegacyProfile {
  role: "admin" | "client";
  clientId: string | null;
  email: string;
  displayName: string;
}

export interface StoredSession {
  token: string;
  profile: LegacyProfile;
}

export function getLegacySession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function setLegacySession(session: StoredSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearLegacySession() {
  localStorage.removeItem(KEY);
}

/** Bearer token for API calls, whichever auth mode is active. */
export async function getAuthToken(): Promise<string | null> {
  if (isLegacyMode) return getLegacySession()?.token ?? null;
  if (!isFirebaseConfigured) return null;
  return (await firebaseAuth().currentUser?.getIdToken()) ?? null;
}
