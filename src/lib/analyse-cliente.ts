/**
 * Analyse du profil d'une cliente (logique pure) : à partir de ses chiffres
 * (pesées, mensurations, ressentis, journal, plan, séances, charges), des constats
 * et des pistes d'ajustement pour la coach.
 *
 * Ce sont des aides à la décision tirées de repères de coaching courants
 * (rythme de perte de 0,5 à 1 % du poids par semaine, protéines 1,6 à 2 g/kg,
 * déficit modéré, remontée calorique progressive…) : jamais un avis médical.
 */

import { joursEntre } from "./bilan";

export type Objectif = "perte" | "maintien" | "prise" | "recompo";
export const OBJECTIFS: Record<Objectif, string> = {
  perte: "Perte de poids",
  maintien: "Maintien / équilibre",
  prise: "Prise de masse",
  recompo: "Recomposition (affiner sans viser un poids)",
};

export type Point = { date: string; valeur: number };

export type DonneesAnalyse = {
  aujourdhui: string;
  /** Préfixe des liens de la fiche : /coach/clientes/<id> */
  base: string;
  debutCoaching: string | null;
  finCoaching: string | null;
  joursSansConnexion: number | null;
  bilansManques: number;
  objectif: Objectif | null;
  poidsObjectif: number | null;
  /** Poids utilisé pour calculer ses besoins. */
  poidsBesoins: number | null;
  metabolismeBase: number | null;
  /** Dépense totale estimée (métabolisme × niveau d'activité actuel). */
  depense: number | null;
  kcalActuelles: number | null;
  kcalObjectif: number | null;
  /** Plan alimentaire en ligne. */
  plan: { depuis: string; kcal: number; proteines: number } | null;
  poids: Point[];
  tourTaille: Point[];
  /** Ressentis des bilans, du plus ancien au plus récent (échelles sur 10). */
  ressentis: { date: string; energie: number | null; sommeil: number | null; stress: number | null; faim: number | null; finirRepas: string | null; planConvient: string | null }[];
  /** Journal quotidien (sommeil en heures, hydratation en litres, stress et digestion sur 5). */
  journal: { jour: string; sommeil: number | null; hydratation: number | null; pas: number | null; stress: number | null; digestion: number | null }[];
  /** Programme sportif en ligne : séances prévues par semaine. */
  programme: { depuis: string; seancesParSemaine: number } | null;
  seancesFaites: string[];
  /** Par exercice : charge maximale de chaque séance, de la plus ancienne à la plus récente. */
  charges: { exercice: string; seances: { date: string; max: number }[] }[];
};

export type Niveau = "important" | "surveiller" | "info" | "bravo";
export type Domaine = "Nutrition" | "Poids & mesures" | "Énergie & récupération" | "Activité" | "Entraînement" | "Suivi";

export type Conseil = {
  id: string;
  niveau: Niveau;
  domaine: Domaine;
  titre: string;
  /** Ce que montrent les chiffres. */
  constat: string;
  /** Ce que la coach peut faire. */
  actions: string[];
  lien?: { href: string; libelle: string };
};

export type Palier = { semaine: number; kcal: number };

export type Analyse = {
  indicateurs: {
    poidsDepart: number | null;
    poidsActuel: number | null;
    evolutionPoids: number | null;
    rythme: { kgSemaine: number; pctSemaine: number; jours: number } | null;
    evolutionTaille: number | null;
    proteinesParKg: number | null;
    seancesParSemaine: number | null;
    pasMoyens: number | null;
    sommeilMoyen: number | null;
  };
  conseils: Conseil[];
  /** Plan de départ progressif quand elle mange nettement sous ses besoins. */
  paliers: Palier[] | null;
};

// ---------------------------------------------------------------- Outils

const f1 = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");
const kcal = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} kcal`;
const arrondi50 = (n: number) => Math.round(n / 50) * 50;
const moyenne = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);

/** Pente (unités par semaine) par moindres carrés, sur les points des `jours` derniers jours. */
export function tendance(points: Point[], aujourdhui: string, jours: number): { parSemaine: number; jours: number; dernier: number } | null {
  const recents = points.filter((p) => joursEntre(p.date, aujourdhui) <= jours && joursEntre(p.date, aujourdhui) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  if (recents.length < 3) return null;
  const etendue = joursEntre(recents[0].date, recents.at(-1)!.date);
  if (etendue < 14) return null;
  const x = recents.map((p) => joursEntre(recents[0].date, p.date));
  const y = recents.map((p) => p.valeur);
  const mx = moyenne(x)!;
  const my = moyenne(y)!;
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const den = x.reduce((s, xi) => s + (xi - mx) ** 2, 0);
  if (den === 0) return null;
  const pente = num / den;
  return { parSemaine: pente * 7, jours: etendue, dernier: my + pente * (x.at(-1)! - mx) };
}

/** Un point par jour (le plus récent l'emporte), du plus ancien au plus récent. */
export function fusionnerPoints(...listes: Point[][]): Point[] {
  const parJour = new Map<string, number>();
  for (const l of listes) for (const p of l) if (Number.isFinite(p.valeur)) parJour.set(p.date, p.valeur);
  return [...parJour].map(([date, valeur]) => ({ date, valeur })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Plan de départ progressif : de ce qu'elle mange aujourd'hui (+ 100 kcal) jusqu'à la cible,
 * par paliers de 100 kcal par semaine (au plus 12 semaines).
 */
export function paliersProgressifs(depart: number, cible: number, pas = 100): Palier[] {
  const paliers: Palier[] = [];
  let k = arrondi50(depart + pas);
  const fin = arrondi50(cible);
  for (let s = 1; s <= 12 && k < fin; s++, k = arrondi50(k + pas)) paliers.push({ semaine: s, kcal: k });
  paliers.push({ semaine: paliers.length + 1, kcal: fin });
  return paliers;
}

// ---------------------------------------------------------------- Analyse

export function analyserCliente(d: DonneesAnalyse): Analyse {
  const conseils: Conseil[] = [];
  const ajouter = (c: Conseil) => conseils.push(c);
  const auj = d.aujourdhui;
  const lienPlan = { href: `${d.base}/plan-alimentaire`, libelle: "Ouvrir son plan alimentaire" };
  const lienBesoins = { href: `${d.base}/plan-alimentaire`, libelle: "Revoir ses besoins" };
  const lienSport = { href: `${d.base}/programme-sportif`, libelle: "Ouvrir son programme sportif" };
  const lienSuivi = { href: `${d.base}/suivi`, libelle: "Voir son suivi" };

  const poids = d.poids;
  const poidsDepart = poids[0]?.valeur ?? d.poidsBesoins;
  const poidsActuel = poids.at(-1)?.valeur ?? d.poidsBesoins;
  const reference = poidsActuel ?? d.poidsBesoins;
  const objectif = d.objectif ?? (d.poidsObjectif && reference ? (d.poidsObjectif < reference - 1 ? "perte" : d.poidsObjectif > reference + 1 ? "prise" : "maintien") : null);
  const semainesCoaching = d.debutCoaching ? Math.max(0, joursEntre(d.debutCoaching, auj)) / 7 : null;

  const t28 = tendance(poids, auj, 28);
  const pct = t28 && reference ? (t28.parSemaine / reference) * 100 : null;
  const taille28 = tendance(d.tourTaille, auj, 35);
  const evolutionTaille = d.tourTaille.length >= 2 ? d.tourTaille.at(-1)!.valeur - d.tourTaille[0].valeur : null;

  // ---------- Calories : ce qu'elle mange, son objectif, ses besoins
  const mb = d.metabolismeBase;
  const depense = d.depense;
  let paliers: Palier[] | null = null;
  if (d.kcalActuelles && mb && depense) {
    const ecart = d.kcalActuelles / depense;
    if (d.kcalActuelles < mb || ecart < 0.75) {
      const cible = objectif === "prise" ? depense + 200 : depense;
      paliers = paliersProgressifs(d.kcalActuelles, cible);
      ajouter({
        id: "sous-alimentation",
        niveau: "important",
        domaine: "Nutrition",
        titre: "Elle mange nettement en dessous de ses besoins",
        constat: `Apport actuel estimé : ${kcal(d.kcalActuelles)}, pour un métabolisme de base d’environ ${kcal(mb)} et une dépense d’environ ${kcal(depense)} (${Math.round(ecart * 100)} % de ses besoins).`,
        actions: [
          `Ne pas créer de déficit supplémentaire : remonter progressivement, environ +100 kcal par semaine, de ${kcal(paliers[0].kcal)} jusqu’à ~${kcal(paliers.at(-1)!.kcal)} (voir le plan de départ ci-dessous).`,
          "Ajouter d’abord des protéines et des glucides autour de l’entraînement, en gardant beaucoup de volume (légumes, fruits).",
          "La prévenir : le poids peut monter de 1 à 2 kg les premières semaines (eau, glycogène, digestion) : c’est normal, ce n’est pas du gras.",
          objectif === "perte"
            ? "Une fois la maintenance stable 2 à 4 semaines (énergie, faim, sommeil corrects), démarrer un déficit modéré (~15 %)."
            : "Faire le point sur l’énergie, la faim et la digestion à chaque palier ; ralentir si l’inconfort digestif augmente.",
          "Si tu suspectes un trouble du comportement alimentaire, l’orienter vers un médecin ou un professionnel spécialisé.",
        ],
        lien: lienBesoins,
      });
    } else if (ecart > 1.25 && objectif === "perte") {
      ajouter({
        id: "sur-apport",
        niveau: "info",
        domaine: "Nutrition",
        titre: "Son apport actuel dépasse largement ses besoins",
        constat: `Apport actuel estimé : ${kcal(d.kcalActuelles)}, pour une dépense d’environ ${kcal(depense)}.`,
        actions: [
          "Descendre par étapes plutôt que d’un coup : d’abord vers la maintenance, puis un déficit modéré (15 à 20 %).",
          "Commencer par les leviers simples : boissons sucrées, grignotages, portions de matières grasses.",
        ],
        lien: lienBesoins,
      });
    }
  }
  if (d.kcalObjectif && mb && d.kcalObjectif < mb) {
    ajouter({
      id: "objectif-sous-mb",
      niveau: "important",
      domaine: "Nutrition",
      titre: "L’objectif calorique est sous son métabolisme de base",
      constat: `Objectif : ${kcal(d.kcalObjectif)} · métabolisme de base estimé : ${kcal(mb)}.`,
      actions: [
        `Remonter l’objectif au moins au niveau du métabolisme de base (~${kcal(arrondi50(mb))}) : un déficit plus doux est plus tenable et protège la masse musculaire.`,
        "Créer le déficit en partie par l’activité (pas, entraînement) plutôt que seulement par l’assiette.",
      ],
      lien: lienBesoins,
    });
  } else if (d.kcalObjectif && depense && objectif === "perte" && d.kcalObjectif < depense * 0.75) {
    ajouter({
      id: "deficit-fort",
      niveau: "surveiller",
      domaine: "Nutrition",
      titre: "Déficit calorique élevé",
      constat: `Objectif : ${kcal(d.kcalObjectif)} pour une dépense d’environ ${kcal(depense)} (déficit de ${Math.round((1 - d.kcalObjectif / depense) * 100)} %).`,
      actions: [
        `Un déficit de 15 à 20 % (~${kcal(arrondi50(depense * 0.82))}) est généralement plus durable.`,
        "Surveiller de près l’énergie, la faim, le sommeil et la performance à l’entraînement.",
      ],
      lien: lienBesoins,
    });
  }

  // ---------- Besoins à recalculer (le poids a changé)
  if (d.poidsBesoins && poidsActuel && Math.abs(poidsActuel - d.poidsBesoins) >= 3) {
    ajouter({
      id: "besoins-obsoletes",
      niveau: "surveiller",
      domaine: "Nutrition",
      titre: "Ses besoins ont été calculés avec un autre poids",
      constat: `Besoins calculés pour ${f1(d.poidsBesoins)} kg ; dernier poids : ${f1(poidsActuel)} kg.`,
      actions: ["Mettre à jour son poids dans ses besoins pour recalculer son métabolisme et sa dépense, puis ajuster le plan si besoin."],
      lien: lienBesoins,
    });
  }

  // ---------- Protéines
  const proteines = d.plan?.proteines ?? null;
  const proteinesParKg = proteines && reference ? proteines / reference : null;
  if (proteinesParKg !== null && reference && proteinesParKg < 1.4 && objectif !== "maintien") {
    ajouter({
      id: "proteines",
      niveau: "surveiller",
      domaine: "Nutrition",
      titre: "Apport en protéines un peu bas",
      constat: `Son plan apporte ${Math.round(proteines!)} g de protéines par jour, soit ${f1(proteinesParKg)} g/kg.`,
      actions: [
        `Viser 1,6 à 2 g/kg, soit environ ${Math.round(reference * 1.6)} à ${Math.round(reference * 2)} g par jour, répartis sur les repas (20 à 40 g par repas).`,
        "Sources faciles : skyr ou fromage blanc, œufs, volaille, poisson, tofu, légumineuses.",
      ],
      lien: lienPlan,
    });
  }

  // ---------- Évolution du poids
  const deficitLong = objectif === "perte" && semainesCoaching !== null && semainesCoaching >= 12;
  if (t28 && pct !== null && reference) {
    const debutRecent = semainesCoaching !== null && semainesCoaching < 3;
    if (objectif === "perte" || objectif === "recompo") {
      const tailleBaisse = taille28 && taille28.parSemaine <= -0.25;
      if (Math.abs(pct) < 0.15 && t28.jours >= 21) {
        if (tailleBaisse) {
          ajouter({
            id: "recompo",
            niveau: "bravo",
            domaine: "Poids & mesures",
            titre: "Le poids stagne, mais son tour de taille baisse",
            constat: `Poids quasi stable depuis ${Math.round(t28.jours / 7)} semaines, tour de taille en baisse (~${f1(Math.abs(taille28!.parSemaine))} cm/semaine).`,
            actions: [
              "C’est le signe d’une recomposition (moins de gras, plus de muscle) : ne pas baisser les calories.",
              "Le lui expliquer et valoriser les mensurations et les photos plutôt que la balance.",
            ],
            lien: lienSuivi,
          });
        } else if (objectif === "perte") {
          const nouvelleCible = d.kcalObjectif ? Math.max(arrondi50(d.kcalObjectif * 0.94), mb ? arrondi50(mb) : 0) : null;
          ajouter({
            id: "stagnation",
            niveau: "important",
            domaine: "Poids & mesures",
            titre: `Stagnation depuis ${Math.round(t28.jours / 7)} semaines`,
            constat: `Variation moyenne : ${f1(t28.parSemaine)} kg/semaine (${f1(pct)} %) sur les ${Math.round(t28.jours / 7)} dernières semaines${taille28 ? ", tour de taille stable" : ""}.`,
            actions: [
              "1. Vérifier l’application du plan : repas finis ? week-ends, grignotages, boissons, quantités d’huile ? (son ressenti dans les bilans).",
              "2. Vérifier les facteurs qui masquent la perte : sommeil, stress, phase du cycle (rétention d’eau), digestion.",
              "3. Augmenter l’activité quotidienne avant de couper : +1 500 à 2 000 pas par jour.",
              nouvelleCible
                ? `4. Si tout est bien suivi depuis 3 semaines ou plus : baisser d’environ 5 % (≈ ${kcal(nouvelleCible)}), sans descendre sous son métabolisme de base.`
                : "4. Si tout est bien suivi depuis 3 semaines ou plus : baisser d’environ 5 % (100 à 150 kcal), sans descendre sous son métabolisme de base.",
              deficitLong
                ? `5. Elle est en déficit depuis ${Math.round(semainesCoaching!)} semaines : envisager 1 à 2 semaines de pause à la maintenance (diet break) avant de recouper.`
                : "5. Varier le plan pour relancer la motivation (nouvelles recettes, nouvelle organisation).",
            ],
            lien: lienPlan,
          });
        }
      } else if (pct < -1 && !debutRecent) {
        ajouter({
          id: "perte-rapide",
          niveau: pct < -1.5 ? "important" : "surveiller",
          domaine: "Poids & mesures",
          titre: "Perte de poids rapide",
          constat: `${f1(t28.parSemaine)} kg/semaine en moyenne sur les ${Math.round(t28.jours / 7)} dernières semaines (${f1(pct)} % du poids), au-delà du repère de 0,5 à 1 %.`,
          actions: [
            "Remonter légèrement les apports (+100 à 200 kcal) pour préserver la masse musculaire et l’énergie.",
            `Vérifier les protéines (1,6 à 2 g/kg, soit ~${Math.round(reference * 1.6)} à ${Math.round(reference * 2)} g/j) et le maintien de la force à l’entraînement.`,
            "Surveiller fatigue, frilosité, chute de cheveux, cycle irrégulier : si ces signes apparaissent, l’orienter vers un médecin.",
          ],
          lien: lienPlan,
        });
      } else if (objectif === "perte" && pct > 0.25 && !debutRecent) {
        ajouter({
          id: "reprise",
          niveau: "surveiller",
          domaine: "Poids & mesures",
          titre: "Le poids remonte",
          constat: `+${f1(t28.parSemaine)} kg/semaine en moyenne sur les ${Math.round(t28.jours / 7)} dernières semaines.`,
          actions: [
            "Échanger avec elle sans culpabiliser : période difficile ? écarts ? changement de rythme ?",
            "Vérifier la rétention d’eau possible (cycle, sel, stress, reprise du sport).",
            "Simplifier le plan si l’organisation coince (repas plus rapides, batch cooking).",
          ],
          lien: lienSuivi,
        });
      } else if (objectif === "perte" && pct <= -0.4) {
        ajouter({
          id: "progression",
          niveau: "bravo",
          domaine: "Poids & mesures",
          titre: "Belle progression",
          constat: `${f1(t28.parSemaine)} kg/semaine en moyenne (${f1(pct)} % du poids) : un rythme sain et durable.`,
          actions: ["Ne rien changer au plan ; la féliciter dans son prochain retour de bilan."],
        });
      }
    } else if (objectif === "prise") {
      if (pct < 0.1 && t28.jours >= 21) {
        ajouter({
          id: "prise-stagne",
          niveau: "surveiller",
          domaine: "Poids & mesures",
          titre: "Le poids ne monte pas",
          constat: `${f1(t28.parSemaine)} kg/semaine sur les ${Math.round(t28.jours / 7)} dernières semaines.`,
          actions: [
            d.kcalObjectif ? `Augmenter de 100 à 150 kcal (≈ ${kcal(arrondi50(d.kcalObjectif + 150))}), de préférence en glucides autour de l’entraînement.` : "Augmenter de 100 à 150 kcal, de préférence en glucides autour de l’entraînement.",
            "Vérifier qu’elle termine ses repas ; sinon ajouter des aliments denses (oléagineux, huile, smoothies).",
          ],
          lien: lienPlan,
        });
      } else if (pct > 0.5) {
        ajouter({
          id: "prise-rapide",
          niveau: "surveiller",
          domaine: "Poids & mesures",
          titre: "Prise de poids rapide",
          constat: `+${f1(t28.parSemaine)} kg/semaine (${f1(pct)} %).`,
          actions: ["Viser 0,25 à 0,5 % par semaine : réduire de 100 à 150 kcal pour limiter la prise de gras."],
          lien: lienPlan,
        });
      }
    }
  } else if (poids.length < 2) {
    ajouter({
      id: "peu-de-pesees",
      niveau: "info",
      domaine: "Suivi",
      titre: "Pas encore assez de pesées pour analyser l’évolution",
      constat: "L’analyse du poids demande au moins 3 pesées sur 2 semaines (bilans ou journal).",
      actions: ["L’encourager à noter son poids dans son journal (même jour de la semaine, le matin à jeun)."],
    });
  }

  // ---------- Bravo : progrès depuis le début
  if (poidsDepart && poidsActuel && objectif === "perte" && poidsDepart - poidsActuel >= 2) {
    ajouter({
      id: "bravo-poids",
      niveau: "bravo",
      domaine: "Poids & mesures",
      titre: `−${f1(poidsDepart - poidsActuel)} kg depuis le début`,
      constat: `De ${f1(poidsDepart)} kg à ${f1(poidsActuel)} kg.`,
      actions: ["Le lui dire ! Les clientes sous-estiment souvent leurs progrès."],
    });
  }
  if (evolutionTaille !== null && evolutionTaille <= -3) {
    ajouter({
      id: "bravo-taille",
      niveau: "bravo",
      domaine: "Poids & mesures",
      titre: `−${f1(-evolutionTaille)} cm de tour de taille`,
      constat: "Depuis sa première mesure.",
      actions: ["Un excellent indicateur de perte de gras abdominal : à valoriser dans ton prochain retour."],
    });
  }

  // ---------- Ressentis des bilans
  const derniers = d.ressentis.slice(-2);
  const moy = (cle: "energie" | "sommeil" | "stress" | "faim") => moyenne(derniers.map((r) => r[cle]).filter((x): x is number => x !== null));
  const energie = moy("energie");
  if (energie !== null && energie <= 4) {
    ajouter({
      id: "fatigue",
      niveau: (pct !== null && pct < -1) || (d.kcalObjectif && depense && d.kcalObjectif < depense * 0.75) ? "important" : "surveiller",
      domaine: "Énergie & récupération",
      titre: "Fatigue dans ses derniers bilans",
      constat: `Énergie moyenne : ${f1(energie)}/10 sur ses ${derniers.length} derniers bilans.`,
      actions: [
        "Vérifier que le déficit n’est pas trop fort et que les glucides sont suffisants autour des entraînements.",
        "Regarder son sommeil et son stress ; alléger temporairement l’entraînement si besoin (semaine plus légère).",
        "Si la fatigue persiste malgré les ajustements : lui conseiller de consulter (bilan sanguin, fer, thyroïde).",
      ],
      lien: lienPlan,
    });
  }
  const sommeilBilan = moy("sommeil");
  const journal14 = d.journal.filter((j) => joursEntre(j.jour, auj) < 14 && joursEntre(j.jour, auj) >= 0);
  const journalAvant = d.journal.filter((j) => joursEntre(j.jour, auj) >= 14 && joursEntre(j.jour, auj) < 28);
  const moyJ = (l: typeof d.journal, cle: "sommeil" | "hydratation" | "pas" | "stress" | "digestion") => {
    const v = l.map((j) => j[cle]).filter((x): x is number => x !== null);
    return v.length >= 5 ? moyenne(v) : null;
  };
  const sommeilH = moyJ(journal14, "sommeil");
  if ((sommeilH !== null && sommeilH < 6.5) || (sommeilBilan !== null && sommeilBilan <= 4)) {
    ajouter({
      id: "sommeil",
      niveau: "surveiller",
      domaine: "Énergie & récupération",
      titre: "Sommeil insuffisant",
      constat: sommeilH !== null ? `${f1(sommeilH)} h par nuit en moyenne ces 2 dernières semaines.` : `Qualité du sommeil : ${f1(sommeilBilan!)}/10 dans ses derniers bilans.`,
      actions: [
        "Le manque de sommeil augmente la faim et freine la perte : en faire une priorité avant de toucher aux calories.",
        "Pistes : heure de coucher régulière, écrans coupés 1 h avant, caféine avant 14 h, dîner pas trop tardif.",
      ],
    });
  }
  const stress = moy("stress");
  const stressJ = moyJ(journal14, "stress");
  if ((stress !== null && stress >= 7) || (stressJ !== null && stressJ >= 4)) {
    ajouter({
      id: "stress",
      niveau: "surveiller",
      domaine: "Énergie & récupération",
      titre: "Stress élevé",
      constat: stress !== null && stress >= 7 ? `Stress moyen : ${f1(stress)}/10 dans ses derniers bilans.` : `Stress moyen : ${f1(stressJ!)}/5 dans son journal.`,
      actions: [
        "Ne pas durcir le déficit en période de stress (rétention d’eau, fringales) : privilégier la régularité.",
        "Proposer des activités qui apaisent (marche, mobilité, respiration) et simplifier le plan si l’organisation pèse.",
      ],
    });
  }
  const faim = moy("faim");
  const encoreFaim = derniers.filter((r) => r.finirRepas?.toLowerCase().includes("encore faim")).length;
  if ((faim !== null && faim >= 7) || encoreFaim >= 1) {
    ajouter({
      id: "faim",
      niveau: encoreFaim >= 2 || (faim !== null && faim >= 8) ? "important" : "surveiller",
      domaine: "Nutrition",
      titre: "Elle a faim",
      constat: encoreFaim ? `« J’ai encore faim » dans ${encoreFaim} de ses ${derniers.length} derniers bilans.` : `Faim entre les repas : ${f1(faim!)}/10.`,
      actions: [
        "Augmenter le volume à calories égales : légumes à chaque repas, soupes, fruits entiers.",
        "Augmenter les protéines et les fibres (rassasiantes) ; ajouter une collation protéinée si elle tient mal entre les repas.",
        "Si la faim reste forte avec un déficit important : remonter de 100 à 150 kcal.",
      ],
      lien: lienPlan,
    });
  }
  if (derniers.some((r) => r.finirRepas?.toLowerCase().includes("copieux"))) {
    ajouter({
      id: "trop-copieux",
      niveau: "info",
      domaine: "Nutrition",
      titre: "Les repas lui semblent trop copieux",
      constat: "« C’est trop copieux » dans un de ses derniers bilans.",
      actions: [
        "Répartir sur une collation de plus, ou utiliser des aliments plus denses (moins de volume pour les mêmes apports).",
        "Vérifier qu’elle ne mangeait pas très peu avant (voir l’apport actuel) : dans ce cas, augmenter plus progressivement.",
      ],
      lien: lienPlan,
    });
  }
  if (derniers.some((r) => r.planConvient?.toLowerCase().includes("pas vraiment"))) {
    ajouter({
      id: "plan-ne-convient-pas",
      niveau: "important",
      domaine: "Nutrition",
      titre: "Le plan ne lui convient pas",
      constat: "« Pas vraiment » à « Est-ce que ton plan te convient ? » dans un de ses derniers bilans.",
      actions: [
        "En parler avec elle : goûts, temps de préparation, budget, vie de famille, horaires.",
        "Ajouter des alternatives à chaque repas et des recettes simples ; un plan suivi à 80 % vaut mieux qu’un plan parfait abandonné.",
      ],
      lien: lienPlan,
    });
  }

  // ---------- Plan alimentaire ancien
  if (d.plan) {
    const semainesPlan = joursEntre(d.plan.depuis, auj) / 7;
    if (semainesPlan >= 10) {
      ajouter({
        id: "plan-ancien",
        niveau: "info",
        domaine: "Nutrition",
        titre: `Même plan depuis ${Math.round(semainesPlan)} semaines`,
        constat: `Plan en ligne depuis le ${new Date(`${d.plan.depuis.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.`,
        actions: [
          "Le varier pour éviter la lassitude (nouvelles recettes, nouvelles alternatives).",
          "Recalculer ses besoins avec son poids actuel et ajuster si l’objectif a évolué.",
        ],
        lien: lienPlan,
      });
    }
  } else if (semainesCoaching !== null && semainesCoaching >= 1) {
    ajouter({
      id: "pas-de-plan",
      niveau: "info",
      domaine: "Nutrition",
      titre: "Pas de plan alimentaire en ligne",
      constat: "Aucun plan alimentaire n’est publié dans son appli.",
      actions: ["Lui préparer son plan (besoins, puis repas et alternatives)."],
      lien: lienPlan,
    });
  }

  // ---------- Journal : pas, hydratation, digestion
  const pas = moyJ(journal14, "pas");
  const pasAvant = moyJ(journalAvant, "pas");
  if (pas !== null && pas < 6000) {
    ajouter({
      id: "pas",
      niveau: "surveiller",
      domaine: "Activité",
      titre: "Peu de pas au quotidien",
      constat: `${Math.round(pas).toLocaleString("fr-FR")} pas par jour en moyenne ces 2 dernières semaines.`,
      actions: [
        `Objectif progressif : +1 000 pas par jour chaque semaine (≈ ${Math.round(Math.min(pas + 1000, 10000) / 500) * 500} pas cette semaine), vers 8 000 à 10 000.`,
        "Idées : marcher pendant les appels, descendre un arrêt plus tôt, 10 min de marche après les repas.",
      ],
    });
  } else if (pas !== null && pasAvant !== null && pas < pasAvant * 0.75) {
    ajouter({
      id: "pas-baisse",
      niveau: "surveiller",
      domaine: "Activité",
      titre: "Elle bouge moins qu’avant",
      constat: `${Math.round(pas).toLocaleString("fr-FR")} pas/jour ces 2 semaines, contre ${Math.round(pasAvant).toLocaleString("fr-FR")} les 2 semaines d’avant.`,
      actions: [
        "En parler avec elle (travail, météo, fatigue, motivation) : c’est souvent la première chose qui baisse quand la motivation flanche.",
        "Une baisse d’activité peut à elle seule expliquer une stagnation : la prendre en compte avant de baisser les calories.",
      ],
    });
  }
  const eau = moyJ(journal14, "hydratation");
  if (eau !== null && eau < 1.5) {
    ajouter({
      id: "hydratation",
      niveau: "info",
      domaine: "Énergie & récupération",
      titre: "Hydratation faible",
      constat: `${f1(eau)} L par jour en moyenne.`,
      actions: ["Viser 1,5 à 2 L par jour (plus les jours d’entraînement) : une gourde visible, un verre à chaque repas."],
    });
  }
  const digestion = moyJ(journal14, "digestion");
  if (digestion !== null && digestion <= 2) {
    ajouter({
      id: "digestion",
      niveau: "surveiller",
      domaine: "Nutrition",
      titre: "Inconfort digestif",
      constat: `Confort digestif moyen : ${f1(digestion)}/5.`,
      actions: [
        "Augmenter les fibres progressivement (pas d’un coup), bien s’hydrater, manger plus lentement.",
        "Repérer les aliments mal tolérés ; si l’inconfort persiste, lui conseiller d’en parler à un médecin.",
      ],
      lien: lienPlan,
    });
  }

  // ---------- Entraînement
  let seancesParSemaine: number | null = null;
  if (d.programme) {
    const joursProgramme = Math.min(28, Math.max(0, joursEntre(d.programme.depuis, auj)));
    const faites28 = d.seancesFaites.filter((x) => joursEntre(x, auj) < 28 && joursEntre(x, auj) >= 0 && x >= d.programme!.depuis.slice(0, 10)).length;
    if (joursProgramme >= 14) {
      seancesParSemaine = faites28 / (joursProgramme / 7);
      const prevues = d.programme.seancesParSemaine;
      const faites14 = d.seancesFaites.filter((x) => joursEntre(x, auj) < 14 && joursEntre(x, auj) >= 0).length;
      if (faites14 === 0) {
        ajouter({
          id: "plus-de-seances",
          niveau: "important",
          domaine: "Entraînement",
          titre: "Aucune séance validée depuis 2 semaines",
          constat: `Son programme prévoit ${prevues} séance${prevues > 1 ? "s" : ""} par semaine.`,
          actions: [
            "Prendre de ses nouvelles : blessure, emploi du temps, motivation ?",
            "Proposer une version courte (20-30 min) ou moins de séances pour relancer la régularité.",
            "Vérifier qu’elle valide bien ses séances à la fin du mode séance (sinon elles ne sont pas comptées).",
          ],
          lien: lienSport,
        });
      } else if (seancesParSemaine < prevues * 0.5) {
        ajouter({
          id: "regularite-sport",
          niveau: "surveiller",
          domaine: "Entraînement",
          titre: "Moins de séances que prévu",
          constat: `${f1(seancesParSemaine)} séance${seancesParSemaine >= 2 ? "s" : ""} par semaine en moyenne, pour ${prevues} prévue${prevues > 1 ? "s" : ""}.`,
          actions: ["Adapter le programme à ce qu’elle peut tenir (moins de séances mais régulières) plutôt que de viser trop haut."],
          lien: lienSport,
        });
      } else if (seancesParSemaine >= prevues * 0.9) {
        ajouter({
          id: "bravo-sport",
          niveau: "bravo",
          domaine: "Entraînement",
          titre: "Très régulière à l’entraînement",
          constat: `${f1(seancesParSemaine)} séances par semaine en moyenne, pour ${prevues} prévues.`,
          actions: ["La féliciter : la régularité est le meilleur prédicteur de résultats."],
        });
      }
    }
  }

  const plateaux: string[] = [];
  const progres: string[] = [];
  for (const c of d.charges) {
    const s = c.seances;
    if (s.length < 3) continue;
    const trois = s.slice(-3);
    if (joursEntre(trois[0].date, trois[2].date) >= 14 && trois[2].max <= trois[0].max && trois[0].max > 0) plateaux.push(`${c.exercice} (${f1(trois[2].max)} kg)`);
    if (s.at(-1)!.max > s[0].max) progres.push(`${c.exercice} : ${f1(s[0].max)} → ${f1(s.at(-1)!.max)} kg`);
  }
  if (plateaux.length) {
    ajouter({
      id: "plateau-charges",
      niveau: "info",
      domaine: "Entraînement",
      titre: "Charges qui ne progressent plus",
      constat: `Même charge depuis 3 séances : ${plateaux.slice(0, 4).join(", ")}.`,
      actions: [
        "Si les séries sont faciles : lui proposer d’ajouter 1 à 2,5 kg ou 1 à 2 répétitions.",
        "Si c’est dur : varier (tempo, pause, autre variante) ou prévoir une semaine plus légère.",
        "En déficit calorique, maintenir ses charges est déjà une réussite.",
      ],
      lien: lienSport,
    });
  }
  if (progres.length) {
    ajouter({
      id: "bravo-charges",
      niveau: "bravo",
      domaine: "Entraînement",
      titre: "Elle devient plus forte",
      constat: progres.slice(0, 4).join(" · "),
      actions: ["Le souligner : la force qui monte est un super indicateur, même quand la balance bouge peu."],
    });
  }

  // ---------- Suivi et engagement
  if (d.bilansManques >= 2) {
    ajouter({
      id: "bilans-manques",
      niveau: "important",
      domaine: "Suivi",
      titre: `${d.bilansManques} bilans manqués d’affilée`,
      constat: "Elle n’a pas envoyé ses derniers bilans.",
      actions: [
        "Prendre de ses nouvelles personnellement (message ou appel), sans reproche.",
        "Proposer un bilan plus court ou un rendez-vous si elle traverse une période compliquée.",
      ],
      lien: lienSuivi,
    });
  }
  if (d.joursSansConnexion !== null && d.joursSansConnexion >= 10) {
    ajouter({
      id: "decrochage",
      niveau: "surveiller",
      domaine: "Suivi",
      titre: `Pas connectée depuis ${d.joursSansConnexion} jours`,
      constat: "Signe possible de démotivation.",
      actions: ["Un petit message personnalisé (une victoire à rappeler, une question simple) relance souvent l’engagement."],
    });
  }
  if (d.finCoaching) {
    const reste = joursEntre(auj, d.finCoaching);
    if (reste >= 0 && reste <= 21) {
      ajouter({
        id: "fin-suivi",
        niveau: "info",
        domaine: "Suivi",
        titre: `Fin de son suivi dans ${reste} jour${reste > 1 ? "s" : ""}`,
        constat: "C’est le moment de préparer la suite.",
        actions: [
          "Faire un bilan de fin avec ses progrès (poids, mesures, photos, force, habitudes).",
          "Lui proposer la suite : maintien, nouvel objectif, suivi allégé.",
        ],
      });
    }
  }

  const ordre: Niveau[] = ["important", "surveiller", "info", "bravo"];
  conseils.sort((a, b) => ordre.indexOf(a.niveau) - ordre.indexOf(b.niveau));

  return {
    indicateurs: {
      poidsDepart: poidsDepart ?? null,
      poidsActuel: poidsActuel ?? null,
      evolutionPoids: poidsDepart && poidsActuel ? poidsActuel - poidsDepart : null,
      rythme: t28 && pct !== null ? { kgSemaine: t28.parSemaine, pctSemaine: pct, jours: t28.jours } : null,
      evolutionTaille,
      proteinesParKg,
      seancesParSemaine,
      pasMoyens: pas,
      sommeilMoyen: sommeilH,
    },
    conseils,
    paliers,
  };
}
