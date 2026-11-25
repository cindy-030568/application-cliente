/**
 * Victoires hors balance (logique pure, testée) : ce qui progresse chez une cliente, à partir
 * des données qu'elle remplit déjà. Records de charge par exercice, régularité des séances,
 * nombre de séances, baisse du tour de taille, mieux-être (stress, digestion) dans le journal.
 *
 * Le poids n'est JAMAIS utilisé (ce sont des victoires « hors balance »).
 * En mode sans chiffres, le texte montré à la cliente (et le message proposé à la coach) ne contient aucun nombre.
 * Une victoire compte pendant 7 jours (aujourd'hui et les 6 jours d'avant).
 */
import { ajouterJours, joursEntre } from "./bilan";
import { semaineIso } from "./propositions-messages";

export type TypeVictoire = "record" | "regularite" | "seances" | "taille" | "stress" | "digestion" | "defi";

export type Victoire = {
  /** Unique et stable : sert à ne plus la remontrer une fois vue, et à ne la proposer qu'une fois à la coach. */
  cle: string;
  type: TypeVictoire;
  emoji: string;
  /** Pour la cliente (sans nombre en mode sans chiffres). */
  titre: string;
  /** Pour la coach (avec les chiffres). */
  constat: string;
  /** Petit mot proposé à la coach, modifiable avant envoi (sans nombre en mode sans chiffres). */
  message: string;
};

export type DonneesVictoires = {
  prenom: string;
  sansChiffres: boolean;
  /** Charges notées en séance (jour à Paris). */
  charges: { exercice_cle: string; exercice_nom: string; charge_kg: number; jour: string }[];
  /** Jour (Paris) de chaque séance validée. */
  seances: string[];
  journal: { jour: string; tour_taille: number | null; stress: number | null; digestion: number | null }[];
  /** Défis du mois réussis (jour à Paris de la réussite). */
  defis?: { id: string; titre: string; jour: string }[];
};

export const PALIERS_REGULARITE = [3, 4, 6, 8, 10, 12, 16, 20, 26, 52];
export const PALIERS_SEANCES = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500];
/** Baisse du tour de taille fêtée tous les 2 cm. */
const PAS_TAILLE = 2;

const kg = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("fr-FR")} kg`;
const f1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");
const moyenne = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** « squat », « squat et fentes », « squat, fentes et rowing ». */
function liste(noms: string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  return `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;
}
/** Lundi de la semaine d'un jour. */
function lundi(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  return ajouterJours(jour, -((d.getUTCDay() + 6) % 7));
}

export function detecterVictoires(d: DonneesVictoires, aujourdhui: string): Victoire[] {
  const age = (jour: string) => joursEntre(jour, aujourdhui);
  const recent = (jour: string) => age(jour) >= 0 && age(jour) <= 6;
  const p = d.prenom.trim() || "toi";
  const victoires: Victoire[] = [];

  // ---------- Records de charge : la charge la plus lourde de la semaine dépasse tout ce qu'elle a fait avant.
  const parExercice = new Map<string, DonneesVictoires["charges"]>();
  for (const c of d.charges) {
    if (!(c.charge_kg > 0) || age(c.jour) < 0) continue;
    parExercice.set(c.exercice_cle, [...(parExercice.get(c.exercice_cle) ?? []), c]);
  }
  const records: { nom: string; avant: number; maintenant: number; jour: string }[] = [];
  for (const lignes of parExercice.values()) {
    const avant = lignes.filter((c) => !recent(c.jour));
    const semaine = lignes.filter((c) => recent(c.jour));
    if (!avant.length || !semaine.length) continue;
    const maxAvant = Math.max(...avant.map((c) => c.charge_kg));
    const meilleur = semaine.reduce((m, c) => (c.charge_kg > m.charge_kg ? c : m));
    if (meilleur.charge_kg > maxAvant) records.push({ nom: meilleur.exercice_nom.trim(), avant: maxAvant, maintenant: meilleur.charge_kg, jour: meilleur.jour });
  }
  if (records.length) {
    records.sort((a, b) => b.maintenant / b.avant - a.maintenant / a.avant);
    const noms = records.slice(0, 3).map((r) => r.nom);
    const dernier = records.reduce((m, r) => (r.jour > m ? r.jour : m), "");
    const un = records.length === 1;
    const r = records[0];
    victoires.push({
      cle: `record-${dernier}-${records.length}`,
      type: "record",
      emoji: "🏋️‍♀️",
      titre: un
        ? `Nouveau record : ${r.nom}${d.sansChiffres ? "" : ` à ${kg(r.maintenant)}`} !`
        : `${records.length} nouveaux records cette semaine : ${liste(noms)}${records.length > 3 ? "…" : ""} !`,
      constat: records
        .slice(0, 3)
        .map((x) => `${x.nom} : ${kg(x.maintenant)} (avant ${kg(x.avant)})`)
        .join(" · "),
      message: un
        ? `Bravo ${p} ! Nouveau record sur ${r.nom}${d.sansChiffres ? "" : ` (${kg(r.maintenant)})`} 💪 Tu deviens plus forte séance après séance, je suis fière de toi !`
        : `Bravo ${p} ! ${records.length} nouveaux records cette semaine (${liste(noms)}) 💪 Tu deviens plus forte séance après séance, je suis fière de toi !`,
    });
  }

  // ---------- Régularité : N semaines d'affilée avec au moins 2 séances (fêtée dans la semaine où le cap est atteint).
  const parSemaine = new Map<string, number>();
  for (const s of d.seances) if (age(s) >= 0) parSemaine.set(lundi(s), (parSemaine.get(lundi(s)) ?? 0) + 1);
  const cetteSemaine = lundi(aujourdhui);
  if ((parSemaine.get(cetteSemaine) ?? 0) >= 2) {
    let n = 0;
    for (let l = cetteSemaine; (parSemaine.get(l) ?? 0) >= 2; l = ajouterJours(l, -7)) n++;
    if (PALIERS_REGULARITE.includes(n)) {
      victoires.push({
        cle: `regularite-${n}-${cetteSemaine}`,
        type: "regularite",
        emoji: "🔥",
        titre: `${n} semaines d’affilée avec au moins 2 séances : quelle régularité !`,
        constat: `${n} semaines de suite avec 2 séances ou plus.`,
        message: `${n} semaines d’affilée sans lâcher tes séances ${p} 🔥 C’est ça, la vraie victoire : la régularité. Je suis fière de toi !`,
      });
    }
  }

  // ---------- Nombre de séances : 10e, 25e, 50e… atteinte cette semaine.
  const total = d.seances.filter((s) => age(s) >= 0).length;
  const totalAvant = d.seances.filter((s) => age(s) > 6).length;
  const palier = [...PALIERS_SEANCES].reverse().find((x) => totalAvant < x && total >= x);
  if (palier) {
    victoires.push({
      cle: `seances-${palier}`,
      type: "seances",
      emoji: "🎉",
      titre: `${palier} séances faites depuis le début : chapeau !`,
      constat: `${palier}e séance validée cette semaine.`,
      message: `${palier} séances depuis le début ${p} 🎉 Chacune compte, et tu les as toutes faites. Bravo !`,
    });
  }

  // ---------- Tour de taille : baisse par rapport au départ, fêtée tous les 2 cm.
  const tailles = d.journal
    .filter((j): j is typeof j & { tour_taille: number } => j.tour_taille !== null && age(j.jour) >= 0)
    .sort((a, b) => a.jour.localeCompare(b.jour));
  if (tailles.length >= 2) {
    const depart = moyenne(tailles.slice(0, 3).map((j) => j.tour_taille));
    const derniere = tailles.at(-1)!;
    const avant = [...tailles].reverse().find((j) => !recent(j.jour));
    const baisse = depart - derniere.tour_taille;
    const palierMaintenant = Math.floor(baisse / PAS_TAILLE) * PAS_TAILLE;
    const palierAvant = avant ? Math.floor((depart - avant.tour_taille) / PAS_TAILLE) * PAS_TAILLE : 0;
    if (recent(derniere.jour) && tailles.length > 3 && palierMaintenant >= PAS_TAILLE && palierMaintenant > palierAvant) {
      victoires.push({
        cle: `taille-${palierMaintenant}`,
        type: "taille",
        emoji: "📏",
        titre: d.sansChiffres
          ? "Ton tour de taille a diminué depuis le début : ton corps change !"
          : `−${palierMaintenant} cm de tour de taille depuis le début : ton corps change !`,
        constat: `Tour de taille : ${f1(derniere.tour_taille)} cm, contre ${f1(depart)} cm au départ (−${f1(baisse)} cm).`,
        message: d.sansChiffres
          ? `${p}, ton tour de taille a diminué depuis le début 📏 La preuve que ton corps change, au-delà de la balance. Bravo !`
          : `${p}, −${palierMaintenant} cm de tour de taille depuis le début 📏 La preuve que ton corps change, au-delà de la balance. Bravo !`,
      });
    }
  }

  // ---------- Mieux-être : stress plus bas, digestion meilleure (7 derniers jours comparés aux 3 semaines d'avant).
  const semaine = semaineIso(aujourdhui);
  const valeurs = (cle: "stress" | "digestion", de: number, a: number) =>
    d.journal.filter((j) => age(j.jour) >= de && age(j.jour) <= a && j[cle] !== null).map((j) => j[cle] as number);
  const mieux = (cle: "stress" | "digestion") => {
    const maintenant = valeurs(cle, 0, 6);
    const avant = valeurs(cle, 7, 27);
    if (maintenant.length < 4 || avant.length < 4) return null;
    return { maintenant: moyenne(maintenant), avant: moyenne(avant) };
  };
  const stress = mieux("stress");
  if (stress && stress.avant - stress.maintenant >= 1) {
    victoires.push({
      cle: `stress-${semaine}`,
      type: "stress",
      emoji: "🌿",
      titre: "Moins de stress ces derniers jours : tu prends soin de toi !",
      constat: `Stress moyen ${f1(stress.maintenant)}/5 cette semaine, contre ${f1(stress.avant)}/5 les 3 semaines d’avant.`,
      message: `${p}, ton stress a bien baissé ces derniers jours 🌿 Ça compte autant que le reste : continue de prendre soin de toi comme ça 💛`,
    });
  }
  const digestion = mieux("digestion");
  if (digestion && digestion.maintenant - digestion.avant >= 1) {
    victoires.push({
      cle: `digestion-${semaine}`,
      type: "digestion",
      emoji: "✨",
      titre: "Ta digestion va mieux : ton corps te dit merci !",
      constat: `Digestion ${f1(digestion.maintenant)}/5 cette semaine, contre ${f1(digestion.avant)}/5 les 3 semaines d’avant.`,
      message: `${p}, ta digestion va beaucoup mieux ces derniers jours ✨ Ton corps te dit merci : bravo pour tes efforts !`,
    });
  }

  // ---------- Défi du mois relevé (le titre est écrit par la coach : pas affiché en mode sans chiffres).
  for (const defi of d.defis ?? []) {
    if (!recent(defi.jour)) continue;
    victoires.push({
      cle: `defi-${defi.id}`,
      type: "defi",
      emoji: "🏆",
      titre: d.sansChiffres ? "Défi du mois relevé : bravo !" : `Défi « ${defi.titre} » relevé : bravo !`,
      constat: `Défi « ${defi.titre} » réussi.`,
      message: d.sansChiffres
        ? `${p}, tu as relevé le défi du mois 🏆 Tu es allée au bout, je suis tellement fière de toi !`
        : `${p}, tu as relevé le défi « ${defi.titre} » 🏆 Tu es allée au bout, je suis tellement fière de toi !`,
    });
  }

  if (d.sansChiffres) {
    // Garde-fou : en mode sans chiffres, aucun nombre dans ce que voit la cliente.
    for (const v of victoires) {
      if (v.type === "regularite") {
        v.titre = "Des semaines d’affilée sans lâcher tes séances : quelle régularité !";
        v.message = `Tu ne lâches rien sur tes séances depuis des semaines ${p} 🔥 C’est ça, la vraie victoire : la régularité. Je suis fière de toi !`;
      } else if (v.type === "seances") {
        v.titre = "Encore un cap franchi dans tes séances : chapeau !";
        v.message = `Encore un cap franchi dans tes séances ${p} 🎉 Chacune compte, et tu les as toutes faites. Bravo !`;
      } else if (v.type === "record" && records.length > 1) {
        v.titre = `Nouveaux records cette semaine : ${liste(noms3(records))}${records.length > 3 ? "…" : ""} !`;
        v.message = `Bravo ${p} ! Nouveaux records cette semaine (${liste(noms3(records))}) 💪 Tu deviens plus forte séance après séance, je suis fière de toi !`;
      }
    }
  }
  return victoires;
}

const noms3 = (r: { nom: string }[]) => r.slice(0, 3).map((x) => x.nom);
