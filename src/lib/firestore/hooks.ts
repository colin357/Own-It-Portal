"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

/**
 * Live-subscribe to a Firestore collection query.
 * `key` must change whenever the constraints change (e.g. include filter values in it);
 * the subscription is re-created only when `path` or `key` changes.
 */
export function useCollection<T>(
  path: string | null,
  key: string,
  constraints: QueryConstraint[] = []
): { data: T[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;

  useEffect(() => {
    if (!path) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db(), path), ...constraintsRef.current);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [path, key]);

  return { data, loading, error };
}

export function useDoc<T>(path: string | null): {
  data: T | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db(), path),
      (snap) => {
        setData(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [path]);

  return { data, loading, error };
}
