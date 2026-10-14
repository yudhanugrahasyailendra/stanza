"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

// Client-side view of the Supabase session. Display only: authorization is always
// enforced by RLS and by server-side getUser() checks.
export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [penName, setPenName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    // getSession() reads the local session; a network getUser() here could fail transiently and
    // wrongly report "signed out". Authorization is always re-checked on the server.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setPenName("");
      return;
    }
    let cancelled = false;
    createClient()
      .from("profiles")
      .select("pen_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPenName(data?.pen_name ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    setUser(null);
    setPenName("");
  }, []);

  return { user, penName, loading, signOut };
}
