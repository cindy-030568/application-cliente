import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_RESTER, appliquerPreference } from "@/lib/session-preference";

const ROUTES_PUBLIQUES = ["/connexion", "/auth/confirm"];
// /compte/mot-de-passe exige une session : il n'est pas public.

/** Rafraîchit la session et renvoie vers /connexion si personne n'est connecté. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // configuration absente : la page affichera l'erreur

  const rester = request.cookies.get(COOKIE_RESTER)?.value !== "0";
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, appliquerPreference(options, rester)),
        );
      },
    },
  });

  // Ne rien intercaler entre createServerClient et getClaims().
  const { data } = await supabase.auth.getClaims();
  const connectee = Boolean(data?.claims?.sub);

  const chemin = request.nextUrl.pathname;
  const publique = ROUTES_PUBLIQUES.some((r) => chemin === r || chemin.startsWith(r + "/"));

  if (!connectee && !publique) {
    const redirection = request.nextUrl.clone();
    redirection.pathname = "/connexion";
    redirection.search = "";
    const r = NextResponse.redirect(redirection);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  }

  return response;
}
