import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { texteBilanPourClaude } from "@/lib/bilan-claude";
import { chargerBilan, chargerBilans, chargerChamps } from "@/lib/suivi";

/**
 * Le texte anonymisé d'un bilan (le même pour « Copier pour Claude » et pour le brouillon) :
 * pas de nom, pas d'email, pas de photo, pas de date précise. Renvoie aussi le prénom,
 * qui reste sur le serveur (il remplace « [prénom] » dans le brouillon, après coup).
 */
export async function texteAnonymiseDuBilan(supabase: SupabaseClient, bilanId: string) {
  const bilan = await chargerBilan(supabase, bilanId);
  if (!bilan) return null;
  const [champs, historique, { data: c }] = await Promise.all([
    chargerChamps(supabase, true),
    chargerBilans(supabase, bilan.cliente_id),
    supabase
      .from("clientes")
      .select("frequence_bilan_jours, date_debut, profils!inner(prenom, nom)")
      .eq("id", bilan.cliente_id)
      .single<{ frequence_bilan_jours: number; date_debut: string | null; profils: { prenom: string; nom: string } }>(),
  ]);
  const index = historique.findIndex((b) => b.id === bilan.id);
  const precedent = index >= 0 ? (historique[index + 1] ?? null) : null;
  const prenom = c?.profils.prenom ?? "";
  const texte = texteBilanPourClaude({
    bilan,
    precedent,
    champs,
    jours: c?.frequence_bilan_jours ?? 14,
    dateDebut: c?.date_debut ?? null,
    identite: [prenom, ...(c?.profils.nom ?? "").split(/\s+/)],
    avecPhotos: bilan.photos.length > 0,
  });
  return { texte, prenom, bilan, champs, historique, precedent, fiche: c };
}
