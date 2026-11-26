import { createAdminClient } from "@/lib/supabase/admin";
import { executerDefis, executerMenus, executerRappelsComplements, executerRappelsJournal, executerRecapsSemaine } from "@/lib/envoi-rappels";
import { sourceAppelPlanifie } from "@/lib/tache-du-matin";

/**
 * Rappels du journal et des compléments, notifications des défis du mois, annonce du menu de la semaine des abonnées
 * (et, le dimanche à partir de 18 h, récap de la semaine),
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
    const defis = await executerDefis(admin).catch(() => ({ annonces: 0, reussites: 0, erreurs: 1 }));
    const menus = await executerMenus(admin).catch(() => ({ annonces: 0, erreurs: 1 }));
    return Response.json({
      ...journal,
      recaps: recap.recaps,
      complements: complements.rappels,
      defis: defis.annonces + defis.reussites,
      menus: menus.annonces,
      erreurs: journal.erreurs + recap.erreurs + complements.erreurs + defis.erreurs + menus.erreurs,
    });
  } catch (e) {
    console.error("Rappels du journal : échec", e instanceof Error ? e.message : "erreur inconnue");
    return Response.json({ erreur: "échec" }, { status: 500 });
  }
}
