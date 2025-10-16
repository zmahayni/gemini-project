"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import NewFilePage from "./new/page";

export default function Home() {
  const search = useSearchParams();
  // No UI text; we process auth silently and route to /new

  useEffect(() => {
    (async () => {
      // Flow H: hash tokens (#access_token, #refresh_token)
      try {
        if (typeof window !== "undefined" && window.location.hash) {
          const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
          const h = new URLSearchParams(hash);
          const access_token = h.get("access_token");
          const refresh_token = h.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            // clean hash
            const cleanUrl = window.location.pathname + window.location.search;
            window.history.replaceState({}, "", cleanUrl);
            return;
          }
        }
      } catch (e: any) {
        // continue to other flows
      }

      // Flow A: token_hash magiclink
      const tokenHash = search.get("token_hash");
      const type = search.get("type");
      if (tokenHash && (type === "magiclink" || type === "recovery")) {
        try {
          const email = typeof window !== "undefined" ? sessionStorage.getItem("pendingEmail") ?? undefined : undefined;
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "recovery", email });
          if (error) throw error;
          return;
        } catch (e: any) {
          // If it fails, fall through to /new; auth header will still reflect session if any
          return;
        }
      }

      // Flow B: PKCE code exchange
      const code = search.get("code");
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          return;
        } catch (e: any) {
          // Fall through
          return;
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <NewFilePage />;
}
