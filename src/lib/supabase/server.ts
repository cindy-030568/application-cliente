import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { COOKIE_RESTER, appliquerPreference } from "@/lib/session-preference";

/**
 * Client lié à la session de l'utilisatrice connectée (soumis à la RLS).
 * `resterConnectee` : forcé à la connexion ; sinon, lu dans la préférence enregistrée.
 */
export async function createClient(resterConnectee?: boolean) {
  const cookieStore = await cookies();
  const rester = resterConnectee ?? cookieStore.get(COOKIE_RESTER)?.value !== "0";
  return createServerClient(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, appliquerPreference(options, rester)),
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
