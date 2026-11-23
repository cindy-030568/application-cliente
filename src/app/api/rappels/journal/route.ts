import { createAdminClient } from "@/lib/supabase/admin";
import { executerRappelsJournal } from "@/lib/envoi-rappels";
import { sourceAppelPlanifie } from "@/lib/tache-du-matin";

/**
 * Rappels du journal, appelés toutes les 15 minutes par l'horloge de Supabase (pg_cron).
 * Autorisé avec « Authorization: Bearer <jeton> » : soit CRON_SECRET, soit le jeton que
 * Supabase a créé lui-même dans son coffre (vérifié par une fonction réservée à la clé secrète).
 * Réponse : compteurs seulement.
 */
export async function GET(request: Request) {
  try {
    const admin = createAdminClient();
    if (!(await sourceAppelPlanifie(request.headers.get("authorization"), admin))) {
      return Response.json({ erreur: "non autorisé" }, { status: 401 });
    }
    return Response.json(await executerRappelsJournal(admin));
  } catch (e) {
    console.error("Rappels du journal : échec", e instanceof Error ? e.message : "erreur inconnue");
    return Response.json({ erreur: "échec" }, { status: 500 });
  }
}
