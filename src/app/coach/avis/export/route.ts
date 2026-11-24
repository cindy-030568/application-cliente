import { lireSession } from "@/lib/auth";
import { csvAvis, type NomAffiche } from "@/lib/parrainage";

/** Export des témoignages (CSV pour Excel), réservé à la coach. */
export async function GET() {
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") return new Response("Accès réservé à la coach.", { status: 403 });
  const { data, error } = await session.supabase
    .from("avis")
    .select("texte, publiable, nom_affiche, contexte, cree_le, clientes(profils(prenom, nom))")
    .order("cree_le", { ascending: false })
    .returns<{ texte: string; publiable: boolean; nom_affiche: NomAffiche | null; contexte: string; cree_le: string; clientes: { profils: { prenom: string; nom: string } } | null }[]>();
  if (error) return new Response("Fais d’abord la mise à jour de la base (0039).", { status: 404 });
  const csv = csvAvis((data ?? []).map((a) => ({ ...a, prenom: a.clientes?.profils.prenom ?? "", nom: a.clientes?.profils.nom ?? "" })));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="temoignages.csv"',
      "cache-control": "no-store",
    },
  });
}
