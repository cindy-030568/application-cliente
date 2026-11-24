import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyserCliente, fusionnerPoints, type Analyse, type DonneesAnalyse, type Objectif, type Point } from "./analyse-cliente";
import { ajouterJours, echeancesPassees, joursEntre } from "./bilan";
import { ageEn, apportsPlan, metabolismeBase } from "./plan-alimentaire";
import { lireBesoins, lirePlansAlimentaires, type Besoins } from "./plan-alimentaire-serveur";
import { jourParisDe } from "./programme-sportif";
import { lireProgrammes } from "./programme-sportif-serveur";
import { regrouperCharges } from "./seance-guidee";
import { estSeanceExpress, lireCharges, lireSeancesFaites } from "./seances-faites-serveur";
import { chargerBilans, chargerChamps } from "./suivi";

type Fiche = {
  date_debut: string | null;
  date_fin: string | null;
  derniere_visite: string | null;
  created_at: string;
  frequence_bilan_jours: number;
};

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Rassemble tout ce qu'on sait d'une cliente, puis l'analyse. Chaque source manquante est simplement ignorée. */
export async function chargerAnalyse(
  supabase: SupabaseClient,
  clienteId: string,
  fiche: Fiche,
  aujourdhui: string,
): Promise<{ analyse: Analyse; besoins: Besoins | null; donnees: DonneesAnalyse }> {
  const depuis = ajouterJours(aujourdhui, -180);
  const [besoinsLus, champs, bilans, journalBrut, plans, programmes, seances, charges] = await Promise.all([
    lireBesoins(supabase, clienteId),
    chargerChamps(supabase, true),
    chargerBilans(supabase, clienteId),
    supabase
      .from("journal_quotidien")
      .select("jour, poids, tour_taille, sommeil, hydratation, pas, stress, digestion")
      .eq("cliente_id", clienteId)
      .gte("jour", depuis)
      .order("jour"),
    lirePlansAlimentaires(supabase, clienteId),
    lireProgrammes(supabase, clienteId),
    lireSeancesFaites(supabase, { clienteId, limite: 200 }),
    lireCharges(supabase, { clienteId, limite: 600 }),
  ]);
  const besoins = besoinsLus?.enregistres ? besoinsLus.besoins : null;

  // ---------- Bilans : poids, tour de taille, ressentis
  const champ = (test: (libelle: string) => boolean, type?: string) =>
    champs.find((c) => test(normaliser(c.libelle)) && (!type || c.type === type))?.id;
  const idsParLibelle = (test: (libelle: string) => boolean, type?: string) =>
    new Set(champs.filter((c) => test(normaliser(c.libelle)) && (!type || c.type === type)).map((c) => c.id));
  const champPoids = new Set(champs.filter((c) => c.est_poids).map((c) => c.id));
  const champTaille = champ((l) => l.includes("tour de taille"));
  const energie = idsParLibelle((l) => l.includes("energie"), "echelle");
  const sommeil = idsParLibelle((l) => l.includes("sommeil"), "echelle");
  const stress = idsParLibelle((l) => l.includes("stress"), "echelle");
  const faim = idsParLibelle((l) => l.includes("faim"), "echelle");
  const finirRepas = champ((l) => l.includes("finir tes repas"));
  const planConvient = champ((l) => l.includes("plan te convient"));

  const chronologiques = [...bilans].sort((a, b) => a.date_mesure.localeCompare(b.date_mesure));
  const val = (b: (typeof bilans)[number], ids: Set<string>) => b.valeurs.find((v) => ids.has(v.champ_id) && v.valeur_num !== null)?.valeur_num ?? null;
  const texte = (b: (typeof bilans)[number], id: string | undefined) => (id ? (b.valeurs.find((v) => v.champ_id === id)?.valeur_texte ?? null) : null);
  const poidsBilans: Point[] = chronologiques.flatMap((b) => {
    const v = val(b, champPoids);
    return v !== null ? [{ date: b.date_mesure, valeur: Number(v) }] : [];
  });
  const tailleBilans: Point[] = champTaille
    ? chronologiques.flatMap((b) => {
        const v = val(b, new Set([champTaille]));
        return v !== null ? [{ date: b.date_mesure, valeur: Number(v) }] : [];
      })
    : [];
  const ressentis = chronologiques.map((b) => ({
    date: b.date_mesure,
    energie: val(b, energie),
    sommeil: val(b, sommeil),
    stress: val(b, stress),
    faim: val(b, faim),
    finirRepas: texte(b, finirRepas),
    planConvient: texte(b, planConvient),
  }));

  // ---------- Journal
  const journal = (journalBrut.error ? [] : (journalBrut.data ?? [])).map((j) => ({
    jour: j.jour as string,
    poids: j.poids == null ? null : Number(j.poids),
    tour_taille: j.tour_taille == null ? null : Number(j.tour_taille),
    sommeil: j.sommeil == null ? null : Number(j.sommeil),
    hydratation: j.hydratation == null ? null : Number(j.hydratation),
    pas: j.pas == null ? null : Number(j.pas),
    stress: j.stress == null ? null : Number(j.stress),
    digestion: j.digestion == null ? null : Number(j.digestion),
  }));
  const poids = fusionnerPoints(poidsBilans, journal.flatMap((j) => (j.poids !== null ? [{ date: j.jour, valeur: j.poids }] : [])));
  const tourTaille = fusionnerPoints(tailleBilans, journal.flatMap((j) => (j.tour_taille !== null ? [{ date: j.jour, valeur: j.tour_taille }] : [])));

  // ---------- Besoins : métabolisme et dépense
  let mb: number | null = null;
  if (besoins?.taille_cm && besoins.poids_kg && besoins.date_naissance) {
    mb = metabolismeBase({
      formule: besoins.formule,
      sexe: besoins.sexe,
      poids: besoins.poids_kg,
      taille: besoins.taille_cm,
      age: ageEn(besoins.date_naissance, aujourdhui),
    });
  }

  // ---------- Plan, programme, séances, charges
  const plan = plans?.find((p) => p.publie) ?? null;
  const apports = plan ? apportsPlan(plan.contenu) : null;
  const programme = programmes?.find((p) => p.publie) ?? null;
  const historique = regrouperCharges(charges ?? []);
  const nomExercice = new Map((charges ?? []).map((c) => [c.exercice_cle, c.exercice_nom]));

  // ---------- Bilans manqués d'affilée (les plus récents)
  const recues = new Set(bilans.map((b) => b.echeance).filter(Boolean));
  let bilansManques = 0;
  for (const e of echeancesPassees(fiche.date_debut, fiche.frequence_bilan_jours, aujourdhui, 3)) {
    if (recues.has(e)) break;
    bilansManques++;
  }

  const donnees: DonneesAnalyse = {
    aujourdhui,
    base: `/coach/clientes/${clienteId}`,
    debutCoaching: fiche.date_debut,
    finCoaching: fiche.date_fin,
    joursSansConnexion: joursEntre((fiche.derniere_visite ?? fiche.created_at).slice(0, 10), aujourdhui),
    bilansManques,
    objectif: (besoins?.objectif as Objectif | null) ?? null,
    poidsObjectif: besoins?.poids_objectif_kg ?? null,
    poidsBesoins: besoins?.poids_kg ?? null,
    metabolismeBase: mb,
    depense: mb && besoins ? mb * besoins.nap_actuel : null,
    kcalActuelles: besoins?.kcal_actuelles ?? null,
    kcalObjectif: besoins?.kcal_objectif ?? plan?.contenu.objectifs?.kcal ?? null,
    plan:
      plan && apports
        ? {
            depuis: plan.publie_le ?? plan.updated_at,
            kcal: apports.kcal || plan.contenu.objectifs?.kcal || 0,
            proteines: apports.proteines || plan.contenu.objectifs?.proteines || 0,
          }
        : null,
    poids,
    tourTaille,
    ressentis,
    journal: journal.map(({ jour, sommeil, hydratation, pas, stress, digestion }) => ({ jour, sommeil, hydratation, pas, stress, digestion })),
    programme: programme ? { depuis: jourParisDe(programme.publie_le ?? programme.updated_at), seancesParSemaine: Math.max(1, Math.min(7, programme.contenu.seances.length)) } : null,
    // Les séances express (séances libres) ne faussent pas le suivi du programme : comptées à part.
    seancesFaites: (seances ?? []).filter((s) => !estSeanceExpress(s)).map((s) => jourParisDe(s.faite_le)),
    seancesExpress: (seances ?? []).filter(estSeanceExpress).map((s) => jourParisDe(s.faite_le)),
    charges: Object.entries(historique).map(([cle, sessions]) => ({
      exercice: nomExercice.get(cle) ?? cle,
      seances: [...sessions].reverse().map((s) => ({ date: jourParisDe(s.date), max: Math.max(...s.series.map((x) => x.kg)) })),
    })),
  };
  return { analyse: analyserCliente(donnees), besoins, donnees };
}
