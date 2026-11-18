"use client";

import { useEffect, useRef, useState } from "react";
import { backendReady, fetchProfile, onAuthChange, type Account, type Profile } from "@/lib/backend";

type Handlers = {
  /** A driver signed in (also fires at start-up when a saved session is found). */
  onSignIn: (account: Account) => void;
  onSignOut: () => void;
};

/** The signed-in driver (Supabase Auth) and their row in public.profiles. */
export function useAccount(handlers: Handlers) {
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!backendReady) return;
    let currentId: string | null = null;
    return onAuthChange((next) => {
      setAccount(next);
      const nextId = next?.id ?? null;
      if (nextId === currentId) return;   // token refresh: same person, nothing to reload
      currentId = nextId;
      if (!next) {
        setProfile(null);
        latest.current.onSignOut();
        return;
      }
      latest.current.onSignIn(next);
      fetchProfile(next.id)
        .then((row) => {
          if (currentId === next.id) setProfile(row);
        })
        .catch((error: unknown) => console.warn("SwapSpot profile:", error));
    });
  }, []);

  return { account, profile, setProfile };
}

/** The name to greet the driver with: profile name, sign-up name, or the part of the email before the @. */
export function displayName(account: Account | null, profile: Profile | null): string {
  if (!account) return "";
  return profile?.fullName || account.name || account.email.split("@")[0];
}
