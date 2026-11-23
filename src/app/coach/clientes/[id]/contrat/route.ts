import { lireSession } from "@/lib/auth";
import { genererPreuveContrat } from "@/lib/contrat-pdf";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARIS = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Paris" });

/** Preuve d'acceptation du contrat d'une cliente (PDF), réservée à la coach. Dernière version acceptée. */
export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") return new Response("Accès réservé à la coach.", { status: 403 });
  if (!UUID.test(id)) return new Response("Introuvable.", { status: 404 });
  const { supabase } = session;
  const [{ data: a }, { data: p }] = await Promise.all([
    supabase
      .from("acceptations_contrat")
      .select("version, texte, accepte_le, texte_renonciation")
      .eq("cliente_id", id)
      .order("accepte_le", { ascending: false })
      .limit(1)
      .maybeSingle<{ version: string; texte: string; accepte_le: string; texte_renonciation: string | null }>(),
    supabase.from("profils").select("prenom, nom, email").eq("id", id).maybeSingle<{ prenom: string; nom: string; email: string }>(),
  ]);
  if (!a || !p) return new Response("Pas de contrat accepté pour cette cliente.", { status: 404 });
  const pdf = await genererPreuveContrat({
    prenom: p.prenom,
    nom: p.nom,
    email: p.email,
    version: a.version,
    accepteLe: PARIS.format(new Date(a.accepte_le)),
    texte: a.texte,
    texteRenonciation: a.texte_renonciation,
    genereLe: PARIS.format(new Date()),
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      // Nom de fichier sans donnée personnelle.
      "content-disposition": `attachment; filename="preuve-contrat-v${a.version.replace(/[^\w.-]/g, "_")}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
