/**
 * Propositions de messages pour la coach (logique pure) : ce qui a changé d'une semaine
 * à l'autre chez une cliente (pas, sommeil, stress, journal, séances…), et un petit mot
 * prêt à envoyer pour garder le contact et la motiver.
 */

import { joursEntre, versDate } from "./bilan";

export type JourJournal = { jour: string; sommeil: number | null; hydratation: number | null; pas: number | null; stress: number | null; poids: number | null };

export type DonneesSemaine = {
  clienteId: string;
  prenom: string;
  /** Mode sans chiffres : jamais de message sur le poids. */
  sansChiffres: boolean;
  objectif: string | null;
  journal: JourJournal[];
  seancesFaites: string[];
  avecProgramme: boolean;
};

export type Proposition = {
  /** Unique par cliente, type et semaine : une proposition traitée ne revient pas la même semaine. */
  cle: string;
  clienteId: string;
  prenom: string;
  ton: "relance" | "bravo" | "victoire";
  titre: string;
  /** Ce qui a changé (pour la coach). */
  constat: string;
  /** Le message proposé (modifiable avant envoi). */
  message: string;
};

/** Semaine ISO : « 2026-W48 ». */
export function semaineIso(date: string): string {
  const d = versDate(date);
  const jour = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - jour + 3); // jeudi de la semaine
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const n = 1 + Math.round(((d.getTime() - premierJeudi.getTime()) / 86_400_000 - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(n).padStart(2, "0")}`;
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");
const entier = (n: number) => Math.round(n).toLocaleString("fr-FR");
/** Moyenne d'un indicateur sur une semaine, s'il est noté au moins 4 jours. */
function moyenneSemaine(j: JourJournal[], cle: keyof Omit<JourJournal, "jour">, min = 4): number | null {
  const v = j.map((x) => x[cle]).filter((x): x is number => x !== null);
  return v.length >= min ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Au plus 3 propositions par cliente : 2 relances d’abord, puis un bravo. */
export function proposerMessages(d: DonneesSemaine, aujourdhui: string): Proposition[] {
  const age = (jour: string) => joursEntre(jour, aujourdhui);
  const cetteSemaine = d.journal.filter((j) => age(j.jour) >= 0 && age(j.jour) <= 6);
  const avant = d.journal.filter((j) => age(j.jour) >= 7 && age(j.jour) <= 13);
  const semaine = semaineIso(aujourdhui);
  const p = d.prenom.trim() || "toi";
  const relances: Proposition[] = [];
  const bravos: Proposition[] = [];
  const ajouter = (liste: Proposition[], type: string, ton: Proposition["ton"], titre: string, constat: string, message: string) =>
    liste.push({ cle: `${type}:${semaine}`, clienteId: d.clienteId, prenom: d.prenom, ton, titre, constat, message });

  // ---------- Relances (bienveillantes)
  if (avant.length >= 4 && cetteSemaine.length <= 1) {
    ajouter(
      relances,
      "journal_abandon",
      "relance",
      "Elle ne remplit plus son journal",
      `${avant.length} jours remplis la semaine dernière, ${cetteSemaine.length} cette semaine.`,
      `Coucou ${p} ! Je n’ai pas vu passer ton journal ces derniers jours 🙂 Pas de pression, juste un petit coucou pour savoir comment tu vas. Même 1 minute par jour m’aide à mieux t’accompagner 💛`,
    );
  }
  const seances = (debut: number, fin: number) => d.seancesFaites.filter((s) => age(s) >= debut && age(s) <= fin).length;
  const seancesCette = seances(0, 6);
  const seancesAvant = seances(7, 13);
  if (d.avecProgramme && seancesAvant >= 2 && seancesCette === 0) {
    ajouter(
      relances,
      "seances_baisse",
      "relance",
      "Pas de séance cette semaine",
      `${seancesAvant} séances la semaine dernière, aucune cette semaine.`,
      `Hello ${p} ! Pas de séance cette semaine : tout va bien ? Si le temps manque, une séance courte de 20 minutes vaut mieux que rien 💪 Dis-moi si on doit adapter ton programme, on trouvera ensemble ce qui te convient.`,
    );
  }
  const sommeil = moyenneSemaine(cetteSemaine, "sommeil");
  const sommeilAvant = moyenneSemaine(avant, "sommeil");
  if (sommeil !== null && sommeilAvant !== null && sommeilAvant - sommeil >= 0.75) {
    ajouter(
      relances,
      "sommeil_baisse",
      "relance",
      "Moins de sommeil",
      `${f1(sommeil)} h par nuit cette semaine, contre ${f1(sommeilAvant)} h la semaine dernière.`,
      `Coucou ${p}, j’ai remarqué que tes nuits ont été plus courtes cette semaine 😴 Comment tu te sens ? Le sommeil joue beaucoup sur la faim et l’énergie : si tu peux, essaie de te coucher 30 minutes plus tôt ces prochains jours. Je suis là si tu veux en parler 💛`,
    );
  }
  const stress = moyenneSemaine(cetteSemaine, "stress");
  const stressAvant = moyenneSemaine(avant, "stress");
  if (stress !== null && stressAvant !== null && stress - stressAvant >= 1) {
    ajouter(
      relances,
      "stress_hausse",
      "relance",
      "Semaine plus stressante",
      `Stress moyen ${f1(stress)}/5 cette semaine, contre ${f1(stressAvant)}/5 la semaine dernière.`,
      `Coucou ${p}, j’ai l’impression que ta semaine a été plus chargée et plus stressante. Ne te mets pas de pression sur le plan : fais au mieux, c’est déjà très bien 🌿 Tu veux qu’on en parle ?`,
    );
  }
  const pas = moyenneSemaine(cetteSemaine, "pas");
  const pasAvant = moyenneSemaine(avant, "pas");
  if (pas !== null && pasAvant !== null && pasAvant >= 4000 && pas <= pasAvant * 0.8) {
    ajouter(
      relances,
      "pas_baisse",
      "relance",
      "Elle a moins bougé (NEAT en baisse)",
      `${entier(pas)} pas par jour cette semaine, contre ${entier(pasAvant)} la semaine dernière (−${Math.round((1 - pas / pasAvant) * 100)} %).`,
      `Coucou ${p} ! J’ai vu que tu as un peu moins bougé cette semaine 🙂 Rien de grave, ça arrive à tout le monde ! Est-ce que tout va bien de ton côté ? Petite idée pour cette semaine : 10 minutes de marche après le déjeuner, ça fait une vraie différence 💪`,
    );
  }
  const eau = moyenneSemaine(cetteSemaine, "hydratation");
  const eauAvant = moyenneSemaine(avant, "hydratation");
  if (eau !== null && eauAvant !== null && eauAvant - eau >= 0.5 && eau < 1.5) {
    ajouter(
      relances,
      "hydratation_baisse",
      "relance",
      "Elle boit moins",
      `${f1(eau)} L par jour cette semaine, contre ${f1(eauAvant)} L la semaine dernière.`,
      `Petit rappel douceur ${p} 💧 Tu as un peu moins bu cette semaine : une gourde toujours à portée de main, et le tour est joué !`,
    );
  }

  // ---------- Bravos
  if (d.avecProgramme && seancesCette >= 3 && seancesCette > seancesAvant) {
    ajouter(
      bravos,
      "seances_hausse",
      "bravo",
      "Très régulière à l’entraînement",
      `${seancesCette} séances validées cette semaine (${seancesAvant} la semaine dernière).`,
      `Quelle régularité cette semaine ${p} 🔥 ${seancesCette} séances validées, je suis fière de toi ! Continue comme ça 💪`,
    );
  }
  if (pas !== null && pasAvant !== null && pas >= 6000 && pas >= pasAvant * 1.2) {
    ajouter(
      bravos,
      "pas_hausse",
      "bravo",
      "Elle a beaucoup plus marché",
      `${entier(pas)} pas par jour cette semaine, contre ${entier(pasAvant)} la semaine dernière (+${Math.round((pas / pasAvant - 1) * 100)} %).`,
      `Bravo ${p} ! Tu as beaucoup plus marché cette semaine 👏 C’est exactement ce genre de petites habitudes qui font la différence sur la durée, continue comme ça 💛`,
    );
  }
  if (sommeil !== null && sommeilAvant !== null && sommeil - sommeilAvant >= 0.75 && sommeil >= 7) {
    ajouter(
      bravos,
      "sommeil_hausse",
      "bravo",
      "Elle dort mieux",
      `${f1(sommeil)} h par nuit cette semaine, contre ${f1(sommeilAvant)} h la semaine dernière.`,
      `Tes nuits sont plus longues cette semaine ${p}, top ! 😴✨ Ton corps te dira merci : garde bien ce temps de repos, c’est un vrai allié pour tes objectifs 💛`,
    );
  }
  if (!d.sansChiffres && d.objectif !== "prise" && d.objectif !== "maintien") {
    const poids = moyenneSemaine(cetteSemaine, "poids", 2);
    const poidsAvant = moyenneSemaine(avant, "poids", 2);
    if (poids !== null && poidsAvant !== null && poidsAvant - poids >= 0.3) {
      ajouter(
        bravos,
        "poids_baisse",
        "bravo",
        "Sa courbe descend",
        `Moyenne de la semaine : ${f1(poids)} kg, contre ${f1(poidsAvant)} kg la semaine dernière.`,
        `Ta courbe continue de descendre ${p} 📉✨ Tes efforts paient, je suis vraiment contente pour toi. On garde le cap !`,
      );
    }
  }

  return [...relances.slice(0, 2), ...bravos.slice(0, 1)];
}
