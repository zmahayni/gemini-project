"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Non-fatal for this vertical slice, but helpful during development
  // eslint-disable-next-line no-console
  console.warn("Supabase env vars are not set.\nNEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required to use Supabase.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
