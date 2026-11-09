"use client";

import { createClient } from "@supabase/supabase-js";

/** Client navigateur sans session : sert uniquement à envoyer un fichier avec un jeton signé. */
export function clientDepot() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
