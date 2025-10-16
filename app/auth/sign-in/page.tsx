"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("Please enter an email.");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}`;
      try {
        sessionStorage.setItem("pendingEmail", email);
      } catch {}
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (err) throw err;
      setMessage("Magic link sent. Check your email to sign in.");
    } catch (err: any) {
      setError(err?.message || "Failed to send magic link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Sign in</h1>
          <p className="mt-2 text-sm text-gray-600">Use your email to receive a magic sign-in link.</p>
        </div>

        {/* Card */}
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-gray-200 bg-white p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>

          {message && (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">{message}</div>
          )}
          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
