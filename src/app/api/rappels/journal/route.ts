import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { executerRappelsJournal } from "@/lib/envoi-rappels";

/**
 * Rappels du journal, appelés toutes les 15 minutes par l'horloge de Supabase (pg_cron).
 * Autorisé avec « Authorization: Bearer <jeton> » : soit CRON_SECRET, soit le jeton que
 * Supabase a créé lui-même dans son coffre (vérifié par une fonction réservée à la clé secrète).
 * Réponse : compteurs seulement.
 */
export async function GET(request: Request) {
  const jeton = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!jeton || jeton.length > 200) return Response.json({ erreur: "non autorisé" }, { status: 401 });
  const secret = process.env.CRON_SECRET;
  let autorise = false;
  if (secret && jeton.length === secret.length) autorise = timingSafeEqual(Buffer.from(jeton), Buffer.from(secret));
  try {
    const admin = createAdminClient();
    if (!autorise) {
      const { data } = await admin.rpc("jeton_horloge_valide", { p_jeton: jeton });
      autorise = data === true;
    }
    if (!autorise) return Response.json({ erreur: "non autorisé" }, { status: 401 });
    return Response.json(await executerRappelsJournal(admin));
  } catch (e) {
    console.error("Rappels du journal : échec", e instanceof Error ? e.message : "erreur inconnue");
    return Response.json({ erreur: "échec" }, { status: 500 });
  }
}
