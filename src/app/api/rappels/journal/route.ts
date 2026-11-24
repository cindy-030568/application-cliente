import { createAdminClient } from "@/lib/supabase/admin";
import { executerRappelsComplements, executerRappelsJournal, executerRecapsSemaine } from "@/lib/envoi-rappels";
import { sourceAppelPlanifie } from "@/lib/tache-du-matin";

/**
 * Rappels du journal et des compléments (et, le dimanche à partir de 18 h, récap de la semaine),
 * appelés toutes les 15 minutes par l'horloge de Supabase (pg_cron).
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
    const journal = await executerRappelsJournal(admin);
    // Le récap ne doit jamais empêcher les rappels du journal (et inversement).
    const recap = await executerRecapsSemaine(admin).catch(() => ({ recaps: 0, erreurs: 1 }));
    const complements = await executerRappelsComplements(admin).catch(() => ({ rappels: 0, erreurs: 1 }));
    return Response.json({
      ...journal,
      recaps: recap.recaps,
      complements: complements.rappels,
      erreurs: journal.erreurs + recap.erreurs + complements.erreurs,
    });
  } catch (e) {
    console.error("Rappels du journal : échec", e instanceof Error ? e.message : "erreur inconnue");
    return Response.json({ erreur: "échec" }, { status: 500 });
  }
}
