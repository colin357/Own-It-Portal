import { adminAuth } from "@/lib/firebase/admin";
import { legacyModeEnabled, verifyLegacyToken } from "@/lib/legacyAuth";

export interface AuthedUser {
  uid: string;
  role: "admin" | "client" | null;
  clientId: string | null;
  email: string | null;
}

/**
 * Verifies the Authorization: Bearer token on an API request.
 * Accepts Firebase ID tokens, and legacy session tokens when
 * NEXT_PUBLIC_LEGACY_AUTH=true. Returns null if unauthenticated.
 */
export async function verifyRequest(req: Request): Promise<AuthedUser | null> {
  const authz = req.headers.get("authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return null;

  if (legacyModeEnabled()) {
    const session = verifyLegacyToken(token);
    if (session) {
      return {
        uid: session.uid,
        role: session.role,
        clientId: session.clientId,
        email: session.email,
      };
    }
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      role: (decoded.role as "admin" | "client" | undefined) ?? null,
      clientId: (decoded.clientId as string | undefined) ?? null,
      email: decoded.email ?? null,
    };
  } catch {
    return null;
  }
}
