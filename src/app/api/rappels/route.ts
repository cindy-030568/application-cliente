import { createAdminClient } from "@/lib/supabase/admin";
import { lancerTacheDuMatin, sourceAppelPlanifie } from "@/lib/tache-du-matin";

/**
 * Tâche quotidienne des rappels (bilans, paiements, programmes sportifs).
 * Lancée chaque matin par l'horloge de Supabase (supabase/horloge-rappels.sql, 7 h à Paris),
 * et en secours par l'hébergeur (vercel.json ou netlify/functions) avec CRON_SECRET.
 * Un seul passage par jour : les appels suivants répondent « déjà faite » sans rien envoyer.
 * La réponse ne contient que des compteurs (aucune donnée personnelle).
 */
export async function GET(request: Request) {
  try {
    const admin = createAdminClient();
    const source = await sourceAppelPlanifie(request.headers.get("authorization"), admin);
    if (!source) return Response.json({ erreur: "non autorisé" }, { status: 401 });
    return Response.json(await lancerTacheDuMatin(admin, source));
  } catch (e) {
    console.error("Rappels : échec de la tâche", e instanceof Error ? e.message : "erreur inconnue");
    return Response.json({ erreur: "échec" }, { status: 500 });
  }
}
