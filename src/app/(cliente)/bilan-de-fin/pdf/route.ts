import { lireSession } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { bilanFinVisible } from "@/lib/bilan-fin";
import { genererPdfBilanFin } from "@/lib/bilan-fin-pdf";
import { chargerBilanFin } from "@/lib/bilan-fin-serveur";
import { COLONNES_FICHE, type FicheCliente } from "@/lib/types";

export const maxDuration = 30;

/** Bilan de fin de suivi en PDF, pour la cliente connectée seulement. */
export async function GET() {
  const session = await lireSession();
  if (!session || session.profil.role !== "cliente") return new Response("Connecte-toi d’abord.", { status: 403 });
  const { supabase, profil } = session;
  const { data: fiche } = await supabase.from("clientes").select(COLONNES_FICHE).eq("id", profil.id).maybeSingle<FicheCliente>();
  if (!fiche || !bilanFinVisible(fiche, aujourdhuiParis())) return new Response("Ton bilan de fin n’est pas encore disponible.", { status: 404 });
  const d = await chargerBilanFin(supabase, { ...fiche, id: profil.id, prenom: profil.prenom });
  let photos: { avant: Uint8Array; apres: Uint8Array } | null = null;
  if (d.photos) {
    const [a, b] = await Promise.all([supabase.storage.from("photos").download(d.photos.avant.chemin), supabase.storage.from("photos").download(d.photos.apres.chemin)]);
    if (a.data && b.data) photos = { avant: new Uint8Array(await a.data.arrayBuffer()), apres: new Uint8Array(await b.data.arrayBuffer()) };
  }
  let pdf: Uint8Array;
  try {
    pdf = await genererPdfBilanFin(d, photos);
  } catch {
    // Photo illisible : le bilan part sans les photos plutôt que pas du tout.
    pdf = await genererPdfBilanFin(d, null);
  }
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      // Nom de fichier sans donnée personnelle.
      "content-disposition": 'attachment; filename="mon-bilan-de-fin-de-suivi.pdf"',
      "cache-control": "no-store",
    },
  });
}
