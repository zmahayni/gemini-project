"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AuthHeader() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // 1) If a Supabase magic link sent us tokens via hash, set the session immediately
    (async () => {
      try {
        if (typeof window !== "undefined" && window.location.hash) {
          const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
          const h = new URLSearchParams(hash);
          const access_token = h.get("access_token");
          const refresh_token = h.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!error) {
              // Clean the hash so it doesn't persist in the URL bar
              const cleanUrl = window.location.pathname + window.location.search;
              window.history.replaceState({}, "", cleanUrl);
            }
          }
        }
      } catch {}
      // 2) Read current session for initial render
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setEmail(data.session?.user?.email ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="border-b border-gray-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold">DocSmith</Link>
        <nav className="flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-700 hover:underline">Home</Link>
          {email ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">{email}</span>
              <button onClick={onSignOut} className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white">Sign out</button>
            </div>
          ) : (
            <Link href="/auth/sign-in" className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
