import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { echeancesARecreer, estMoyen, lireCentimes, NB_FOIS_MAX, type Echeance, type Moyen, type Paiement } from "@/lib/paiements";

/** Formule, paiement et échéancier d'une cliente ; null si la mise à jour 0010 n'est pas encore faite. */
export async function lirePaiement(supabase: SupabaseClient, clienteId: string) {
  const [p, e] = await Promise.all([
    supabase
      .from("paiements_clientes")
      .select("formule, montant_total, moyen, nb_fois, note")
      .eq("cliente_id", clienteId)
      .maybeSingle<Paiement>(),
    supabase
      .from("echeances_paiement")
      .select("id, date_echeance, montant, payee_le")
      .eq("cliente_id", clienteId)
      .order("date_echeance")
      .returns<Echeance[]>(),
  ]);
  if (p.error || e.error) return null;
  return {
    paiement: p.data ? { ...p.data, montant_total: p.data.montant_total === null ? null : Number(p.data.montant_total) } : null,
    echeances: (e.data ?? []).map((x) => ({ ...x, montant: Number(x.montant) })),
  };
}

/** Formules déjà utilisées (pour les proposer à la saisie). */
export async function formulesUtilisees(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("paiements_clientes").select("formule").not("formule", "is", null).limit(500);
  return [...new Set((data ?? []).map((d) => String(d.formule).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
}

export type SaisiePaiement = {
  formule: string | null;
  montantCentimes: number | null;
  moyen: Moyen | null;
  nbFois: number;
  premiere: string | null;
  note: string | null;
};

/** Lit les champs « pai_* » d'un formulaire. `vide` : rien n'a été rempli. */
export function lireSaisiePaiement(formData: FormData): { erreur?: string; saisie: SaisiePaiement; vide: boolean } {
  const t = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max);
  const formule = t("pai_formule", 120) || null;
  const montantCentimes = lireCentimes(t("pai_montant", 20));
  const moyenBrut = t("pai_moyen", 20);
  const moyen = estMoyen(moyenBrut) ? moyenBrut : null;
  const nbFois = Number(t("pai_nb_fois", 2) || 1);
  const premiereBrute = t("pai_premiere", 10);
  const premiere = /^\d{4}-\d{2}-\d{2}$/.test(premiereBrute) ? premiereBrute : null;
  const note = t("pai_note", 500) || null;
  const saisie = { formule, montantCentimes, moyen, nbFois, premiere, note };
  const vide = !formule && montantCentimes === null && !note;
  let erreur: string | undefined;
  if (Number.isNaN(montantCentimes)) erreur = "Le montant n’est pas valide (exemple : 450 ou 149,90).";
  else if (!Number.isInteger(nbFois) || nbFois < 1 || nbFois > NB_FOIS_MAX) erreur = `Le paiement se fait en 1 à ${NB_FOIS_MAX} fois.`;
  else if (montantCentimes !== null && !premiere) erreur = "Indique la date du premier paiement.";
  return { erreur, saisie, vide };
}

/**
 * Enregistre formule et paiement, puis recalcule les échéances non payées
 * (les échéances déjà cochées « payée » ne bougent pas).
 */
export async function sauverPaiement(supabase: SupabaseClient, clienteId: string, s: SaisiePaiement) {
  const { error } = await supabase.from("paiements_clientes").upsert({
    cliente_id: clienteId,
    formule: s.formule,
    montant_total: s.montantCentimes === null ? null : s.montantCentimes / 100,
    moyen: s.moyen,
    nb_fois: s.nbFois,
    note: s.note,
  });
  if (error) return false;
  const { data: existantes } = await supabase
    .from("echeances_paiement")
    .select("id, montant, payee_le, date_echeance")
    .eq("cliente_id", clienteId)
    .order("date_echeance");
  const payees = (existantes ?? []).filter((e) => e.payee_le).map((e) => ({ montant: Number(e.montant) }));
  const aSupprimer = (existantes ?? []).filter((e) => !e.payee_le).map((e) => e.id as string);
  if (aSupprimer.length) {
    const { error: e1 } = await supabase.from("echeances_paiement").delete().in("id", aSupprimer);
    if (e1) return false;
  }
  if (s.montantCentimes !== null && s.premiere) {
    const nouvelles = echeancesARecreer(s.montantCentimes, s.nbFois, s.premiere, payees);
    if (nouvelles.length) {
      const { error: e2 } = await supabase
        .from("echeances_paiement")
        .insert(nouvelles.map((n) => ({ ...n, cliente_id: clienteId })));
      if (e2) return false;
    }
  }
  return true;
}

/** Suivi sportif inclus ? (vrai par défaut, et avant la mise à jour 0010). */
export async function lireSuiviSport(supabase: SupabaseClient, clienteId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("clientes")
    .select("suivi_sport")
    .eq("id", clienteId)
    .maybeSingle<{ suivi_sport: boolean }>();
  return error || !data ? true : data.suivi_sport !== false;
}
