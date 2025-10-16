import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold">Signing you in…</h1>
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">Exchanging code for a session…</div>
      </div>
    }>
      <AuthCallbackClient />
    </Suspense>
  );
}
