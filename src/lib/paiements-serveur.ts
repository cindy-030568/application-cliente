import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { echeancesARecreer, estMoyen, lireCentimes, NB_FOIS_MAX, type Echeance, type Moyen, type Paiement } from "@/lib/paiements";

/** Formule, paiement et échéancier d'une cliente ; null si la mise à jour 0010 n'est pas encore faite. */
export async function lirePaiement(supabase: SupabaseClient, clienteId: string) {
  const [p, e, plus] = await Promise.all([
    supabase
      .from("paiements_clientes")
      .select("formule, montant_total, moyen, nb_fois, note")
      .eq("cliente_id", clienteId)
      .maybeSingle<Omit<Paiement, "premier_montant" | "rappels">>(),
    supabase
      .from("echeances_paiement")
      .select("id, date_echeance, montant, payee_le")
      .eq("cliente_id", clienteId)
      .order("date_echeance")
      .returns<Echeance[]>(),
    // Colonnes de la mise à jour 0011, lues à part.
    supabase
      .from("paiements_clientes")
      .select("premier_montant, rappels")
      .eq("cliente_id", clienteId)
      .maybeSingle<{ premier_montant: number | null; rappels: boolean }>(),
  ]);
  if (p.error || e.error) return null;
  // Notes des échéances (0017), lues à part.
  const { data: notes, error: sansNotes } = await supabase.from("echeances_paiement").select("id, note").eq("cliente_id", clienteId);
  const noteDe = new Map((sansNotes ? [] : (notes ?? [])).map((n) => [n.id as string, (n.note as string | null) ?? null]));
  const premier = plus.data?.premier_montant;
  return {
    paiement: p.data
      ? {
          ...p.data,
          montant_total: p.data.montant_total === null ? null : Number(p.data.montant_total),
          premier_montant: premier === null || premier === undefined ? null : Number(premier),
          rappels: plus.data?.rappels ?? true,
        }
      : null,
    echeances: (e.data ?? []).map((x) => ({ ...x, montant: Number(x.montant), note: noteDe.get(x.id) ?? null })),
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
  premierCentimes: number | null;
  rappels: boolean;
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
  const premierCentimes = nbFois > 1 ? lireCentimes(t("pai_premier", 20)) : null;
  const rappels = formData.has("pai_rappels_present") ? formData.get("pai_rappels") === "on" : true;
  const saisie = { formule, montantCentimes, moyen, nbFois, premiere, note, premierCentimes, rappels };
  const vide = !formule && montantCentimes === null && !note;
  let erreur: string | undefined;
  if (Number.isNaN(montantCentimes)) erreur = "Le montant n’est pas valide (exemple : 450 ou 149,90).";
  else if (!Number.isInteger(nbFois) || nbFois < 1 || nbFois > NB_FOIS_MAX) erreur = `Le paiement se fait en 1 à ${NB_FOIS_MAX} fois.`;
  else if (montantCentimes !== null && !premiere) erreur = "Indique la date du premier paiement.";
  else if (Number.isNaN(premierCentimes)) erreur = "Le montant du 1er paiement n’est pas valide.";
  else if (premierCentimes !== null && montantCentimes !== null && premierCentimes > montantCentimes)
    erreur = "Le 1er paiement ne peut pas dépasser le montant total.";
  return { erreur, saisie, vide };
}

/**
 * Enregistre formule et paiement, puis recalcule les échéances non payées
 * (les échéances déjà cochées « payée » ne bougent pas).
 */
export async function sauverPaiement(supabase: SupabaseClient, clienteId: string, s: SaisiePaiement) {
  const base = {
    cliente_id: clienteId,
    formule: s.formule,
    montant_total: s.montantCentimes === null ? null : s.montantCentimes / 100,
    moyen: s.moyen,
    nb_fois: s.nbFois,
    note: s.note,
  };
  let { error } = await supabase.from("paiements_clientes").upsert({
    ...base,
    premier_montant: s.premierCentimes === null ? null : s.premierCentimes / 100,
    rappels: s.rappels,
  });
  // Avant la mise à jour 0011 : on enregistre sans les nouvelles colonnes.
  if (error && /premier_montant|rappels|column/i.test(error.message)) ({ error } = await supabase.from("paiements_clientes").upsert(base));
  if (error) return false;
  const { data: existantes } = await supabase
    .from("echeances_paiement")
    .select("id, montant, payee_le, date_echeance")
    .eq("cliente_id", clienteId)
    .order("date_echeance");
  const payees = (existantes ?? []).filter((e) => e.payee_le).map((e) => ({ montant: Number(e.montant) }));
  const nonPayees = (existantes ?? []).filter((e) => !e.payee_le);
  const nouvelles =
    s.montantCentimes !== null && s.premiere ? echeancesARecreer(s.montantCentimes, s.nbFois, s.premiere, payees, s.premierCentimes) : [];
  // Mêmes montants et même 1re date qu'avant : on garde les échéances telles quelles
  // (dates reportées à la main comprises). Changer la 1re date recalcule l'échéancier.
  const inchangees =
    s.premiere === (existantes ?? [])[0]?.date_echeance &&
    nouvelles.length === nonPayees.length &&
    nouvelles.every((n, i) => Math.round(n.montant * 100) === Math.round(Number(nonPayees[i].montant) * 100));
  if (inchangees && nouvelles.length) return true;
  const aSupprimer = nonPayees.map((e) => e.id as string);
  if (aSupprimer.length) {
    const { error: e1 } = await supabase.from("echeances_paiement").delete().in("id", aSupprimer);
    if (e1) return false;
  }
  if (nouvelles.length) {
    const { error: e2 } = await supabase.from("echeances_paiement").insert(nouvelles.map((n) => ({ ...n, cliente_id: clienteId })));
    if (e2) return false;
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

export type MonPaiement = {
  formule: string | null;
  montant_total: number | null;
  moyen: Moyen | null;
  nb_fois: number;
  echeances: { date_echeance: string; montant: number; payee: boolean }[];
};

/** Formule et échéancier vus par la cliente connectée (sans la note de la coach) ; null si rien. */
export async function lireMonPaiement(supabase: SupabaseClient): Promise<MonPaiement | null> {
  const { data, error } = await supabase.rpc("mon_paiement");
  if (error || !data) return null;
  const p = data as MonPaiement;
  return {
    ...p,
    montant_total: p.montant_total === null ? null : Number(p.montant_total),
    echeances: (p.echeances ?? []).map((e) => ({ ...e, montant: Number(e.montant) })),
  };
}
