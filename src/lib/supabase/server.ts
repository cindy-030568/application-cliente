import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

/** Client lié à la session de l'utilisatrice connectée (soumis à la RLS). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit la session.
        }
      },
    },
  });
}

/** Client sans session, uniquement pour envoyer les emails de connexion. */
export function createEmailClient() {
  return createPlainClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  });
}
