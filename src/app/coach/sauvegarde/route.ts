import { lireSession } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";

/**
 * Sauvegarde complète des données (fichier JSON), réservée à la coach.
 * Exclues : les listes de courses (privées, la coach n'y a pas accès) et les
 * adresses techniques des téléphones abonnés aux notifications.
 * Les fichiers (PDF, photos) restent dans Supabase Storage : seuls leurs chemins sont exportés.
 */
const TABLES = [
  "reglages", "profils", "clientes", "consentements", "notes_coach",
  "plans", "categories_ressource", "ressources", "ressources_clientes",
  "champs_mesure", "bilans", "bilan_valeurs", "photos_bilan", "retours_bilan",
  "filtres_video", "videos", "videos_filtres",
  "categories_aliment", "aliments", "aliments_categories", "repas_cibles", "exclusions",
  "tags", "recettes", "recettes_repas", "recettes_tags", "recette_ingredients", "favoris",
  "rappels_envoyes",
] as const;

export async function GET() {
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") return new Response("Accès réservé à la coach.", { status: 403 });
  const { supabase } = session;

  const donnees: Record<string, unknown[]> = {};
  const absentes: string[] = [];
  for (const table of TABLES) {
    const lignes: unknown[] = [];
    // 1000 lignes par page ; au plus 200 pages par table (garde-fou).
    for (let debut = 0; debut < 200_000; debut += 1000) {
      const { data, error } = await supabase.from(table).select("*").range(debut, debut + 999);
      if (error) {
        absentes.push(table);
        break;
      }
      lignes.push(...(data ?? []));
      if (!data || data.length !== 1000) break;
    }
    donnees[table] = lignes;
  }

  const jour = aujourdhuiParis();
  const contenu = JSON.stringify(
    {
      application: "fitw_cindy",
      format: 1,
      cree_le: new Date().toISOString(),
      note: "Sauvegarde des données de l'app. Les fichiers (PDF, photos) restent dans Supabase Storage.",
      tables_illisibles: absentes,
      donnees,
    },
    null,
    1,
  );
  return new Response(contenu, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="sauvegarde-fitw-cindy-${jour}.json"`,
      "cache-control": "no-store",
    },
  });
}
