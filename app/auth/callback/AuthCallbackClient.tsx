"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [message, setMessage] = useState<string>("Exchanging code for a session…");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      // Flow H: hash-based redirect (e.g. #access_token=...&refresh_token=...)
      try {
        if (typeof window !== "undefined" && window.location.hash) {
          const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
          const h = new URLSearchParams(hash);
          const access_token = h.get("access_token");
          const refresh_token = h.get("refresh_token");
          if (access_token && refresh_token) {
            const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
            if (sErr) throw sErr;
            setMessage("Signed in successfully. Redirecting…");
            // Remove hash from URL
            const cleanUrl = window.location.pathname + window.location.search;
            window.history.replaceState({}, "", cleanUrl);
            setTimeout(() => router.replace("/"), 600);
            return;
          }
        }
      } catch (e: any) {
        // proceed to other flows if hash parsing fails
      }

      // Flow A: token_hash (magic link verify)
      const tokenHash = search.get("token_hash");
      const type = search.get("type");
      if (tokenHash && (type === "magiclink" || type === "recovery")) {
        try {
          const email = typeof window !== "undefined" ? sessionStorage.getItem("pendingEmail") ?? undefined : undefined;
          const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "recovery", email });
          if (vErr) throw vErr;
          setMessage("Signed in successfully. Redirecting…");
          setTimeout(() => router.replace("/"), 600);
          return;
        } catch (e: any) {
          setError(e?.message || "Failed to verify magic link.");
          setMessage("");
          return;
        }
      }

      // Flow B: PKCE code exchange
      const code = search.get("code");
      if (code) {
        try {
          const { error: err } = await supabase.auth.exchangeCodeForSession(code);
          if (err) throw err;
          setMessage("Signed in successfully. Redirecting…");
          setTimeout(() => router.replace("/"), 600);
        } catch (e: any) {
          setError(e?.message || "Failed to complete sign-in.");
          setMessage("");
        }
        return;
      }

      setError("Missing auth parameters in callback URL.");
      setMessage("");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Signing you in…</h1>
      {message && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>
      )}
      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}
