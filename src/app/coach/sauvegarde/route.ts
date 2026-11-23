import { lireSession } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { EXCLUSIONS, TABLES_SAUVEGARDEES } from "@/lib/sauvegarde";

/**
 * Sauvegarde complète des données (fichier JSON), réservée à la coach.
 * La liste des tables (et des exclusions volontaires) est dans src/lib/sauvegarde.ts.
 * Les fichiers (PDF, photos) restent dans Supabase Storage : seuls leurs chemins sont exportés.
 */
export async function GET() {
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") return new Response("Accès réservé à la coach.", { status: 403 });
  const { supabase } = session;

  const donnees: Record<string, unknown[]> = {};
  const absentes: string[] = [];
  for (const table of TABLES_SAUVEGARDEES) {
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
      format: 2,
      cree_le: new Date().toISOString(),
      note: "Sauvegarde des données de l'app. Les fichiers (PDF, photos) ne sont pas dans ce fichier : ils restent dans Supabase Storage, seuls leurs chemins sont exportés.",
      tables_illisibles: absentes,
      tables_exclues: EXCLUSIONS,
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
