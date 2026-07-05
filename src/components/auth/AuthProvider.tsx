"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, db, isFirebaseConfigured } from "@/lib/firebase/client";
import type { PortalUser, Role } from "@/lib/types";

interface AuthState {
  user: User | null;
  profile: PortalUser | null;
  role: Role | null;
  clientId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  role: null,
  clientId: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PortalUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadClaims = useCallback(async (u: User, forceRefresh = false) => {
    let token = await u.getIdTokenResult(forceRefresh);
    let claimRole = (token.claims.role as Role | undefined) ?? null;

    // If no role claim yet, ask the server to bootstrap (admin whitelist) and retry once.
    if (!claimRole && !forceRefresh) {
      try {
        const res = await fetch("/api/auth/bootstrap", {
          method: "POST",
          headers: { Authorization: `Bearer ${token.token}` },
        });
        if (res.ok) {
          token = await u.getIdTokenResult(true);
          claimRole = (token.claims.role as Role | undefined) ?? null;
        }
      } catch {
        // Non-fatal: user simply has no role yet.
      }
    }

    setRole(claimRole);
    setClientId((token.claims.clientId as string | undefined) ?? null);

    try {
      const snap = await getDoc(doc(db(), "portalUsers", u.uid));
      setProfile(snap.exists() ? ({ uid: u.uid, ...snap.data() } as PortalUser) : null);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(firebaseAuth(), async (u) => {
      setUser(u);
      if (u) {
        await loadClaims(u);
      } else {
        setProfile(null);
        setRole(null);
        setClientId(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [loadClaims]);

  const refresh = useCallback(async () => {
    const u = firebaseAuth().currentUser;
    if (u) await loadClaims(u, true);
  }, [loadClaims]);

  const logout = useCallback(async () => {
    await signOut(firebaseAuth());
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, role, clientId, loading, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
