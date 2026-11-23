/**
 * Petit mot d'encouragement du jour (logique pure) : une phrase bienveillante qui change
 * chaque jour, la même pour toutes les clientes, sans se répéter avant d'avoir fait le tour.
 */

import { joursEntre } from "./bilan";

export const ENCOURAGEMENTS: readonly string[] = [
  "Avancer petit pas à petit pas vers ton objectif, c’est de l’amour de soi.",
  "Tu n’as pas besoin d’être parfaite, juste d’être régulière.",
  "Chaque choix bienveillant pour toi compte, même le plus petit.",
  "Ton corps n’est pas un projet à corriger, c’est une maison à chérir.",
  "Aujourd’hui, sois aussi douce avec toi que tu l’es avec ceux que tu aimes.",
  "Les petites habitudes d’aujourd’hui construisent la femme de demain.",
  "Un écart n’efface pas tout ce que tu as déjà accompli.",
  "Tu avances, même les jours où tu ne le vois pas.",
  "Prendre soin de toi n’est pas égoïste, c’est essentiel.",
  "Le progrès, pas la perfection.",
  "Tu es plus forte que tu ne le crois.",
  "Chaque jour est une nouvelle chance de prendre soin de toi.",
  "Ton rythme est le bon rythme.",
  "Bois un grand verre d’eau, respire, et souris : tu fais de ton mieux.",
  "La constance bat toujours l’intensité.",
  "Fière de toi pour chaque pas, même celui que personne ne voit.",
  "Ce que tu fais aujourd’hui, ton corps t’en remerciera demain.",
  "Tu mérites de te sentir bien dans ton corps et dans ta tête.",
  "Une journée imparfaite reste une journée qui compte.",
  "Écoute ton corps : il te parle avec beaucoup de sagesse.",
  "Tu n’es pas en retard, tu es sur ton propre chemin.",
  "Se reposer fait aussi partie du progrès.",
  "Célèbre tes petites victoires, elles sont les fondations des grandes.",
  "Tu as déjà fait le plus dur : commencer.",
  "Nourrir ton corps, c’est te dire « je t’aime » plusieurs fois par jour.",
  "La patience avec toi-même est une forme de courage.",
  "Ce n’est pas une course, c’est un voyage. Profite de la route.",
  "Chaque repas est une occasion de prendre soin de toi, pas de te juger.",
  "Ton énergie d’aujourd’hui est assez. Tu es assez.",
  "Tu peux recommencer à tout moment de la journée.",
  "Les changements durables se construisent en douceur.",
  "Regarde le chemin parcouru avant de regarder celui qui reste.",
  "Bouger, c’est célébrer ce que ton corps sait faire.",
  "Sois fière de la femme que tu es en train de devenir.",
  "La discipline, c’est se souvenir de ce que l’on veut vraiment.",
  "Aujourd’hui, choisis une seule chose bonne pour toi. C’est déjà beaucoup.",
  "Tu n’as pas à mériter ton repas : tu as juste à en profiter.",
  "Ton corps fait tellement pour toi chaque jour. Remercie-le.",
  "Le doute est normal. Continue quand même, je crois en toi.",
  "Plus tu es douce avec toi, plus tu avances loin.",
  "Une marche, un verre d’eau, une bonne nuit : les vrais super-pouvoirs.",
  "Ce n’est pas la balance qui dit qui tu es.",
  "Chaque petit effort s’additionne, même quand tu ne le sens pas.",
  "Tu as le droit d’avoir des jours sans. Demain est un autre jour.",
  "Prends un moment pour toi aujourd’hui : tu le vaux bien.",
  "Ta régularité est en train de tout changer, doucement.",
  "Aime-toi assez pour continuer, même lentement.",
  "Tu es exactement là où tu dois être pour avancer.",
  "Les habitudes simples sont souvent les plus puissantes.",
  "Ton bien-être mérite une place dans ton agenda.",
  "Sois ta meilleure alliée, pas ta pire critique.",
  "Avancer à petits pas, c’est toujours avancer.",
  "Chaque matin est une page blanche : écris-y quelque chose de doux pour toi.",
  "Ta santé est un cadeau que tu te fais chaque jour.",
  "Tu n’as rien à prouver, juste à prendre soin de toi.",
  "Ce que tu ressens compte autant que ce que tu vois.",
  "Ralentir n’est pas abandonner.",
  "Tu es capable de belles choses, et tu le prouves chaque jour.",
  "Le plus beau progrès, c’est de te sentir mieux dans ta peau.",
  "Respire profondément : tu fais du très bon travail.",
  "Rien ne pousse en un jour, mais tout pousse avec du soin.",
  "Tes efforts d’aujourd’hui sont les résultats de demain.",
  "Tu peux être fière de toi sans attendre la ligne d’arrivée.",
  "Un pas de plus qu’hier, c’est une victoire.",
  "Ton corps est ton allié : faites équipe aujourd’hui.",
  "La bienveillance envers soi est le meilleur des carburants.",
  "Quand c’est dur, souviens-toi pourquoi tu as commencé.",
  "Choisir de prendre soin de toi, c’est choisir ton bonheur.",
  "Tu n’es pas seule : on avance ensemble 💛",
  "Ton histoire ne se résume pas à un chiffre.",
  "Les jours difficiles font aussi partie de la réussite.",
  "Un sourire, une marche au soleil, un bon repas : la journée commence bien.",
  "Ta force tranquille est ta plus belle qualité.",
  "Fais aujourd’hui ce que la femme que tu veux être ferait.",
  "Tout ce que tu fais pour toi compte, rien n’est perdu.",
  "Le chemin compte autant que la destination.",
  "Prendre soin de soi, c’est un acte de courage au quotidien.",
  "Tu mérites la même patience que tu offres aux autres.",
  "Tes petites décisions de chaque jour sont tes plus grandes victoires.",
  "Accueille ta journée avec douceur et confiance.",
  "Ton corps change, ta confiance grandit : c’est magnifique.",
  "Tu as tout ce qu’il faut pour réussir, à ton rythme.",
  "Il n’y a pas de mauvais jour, seulement des jours où l’on apprend.",
  "Un peu chaque jour vaut mieux que beaucoup de temps en temps.",
  "Aujourd’hui, félicite-toi pour quelque chose. Tu le mérites.",
  "La meilleure version de toi est celle qui se respecte.",
  "Ton engagement envers toi-même est inspirant.",
  "Doucement, sûrement, sereinement : c’est comme ça qu’on avance.",
  "Ce que tu sèmes aujourd’hui fleurira bientôt.",
  "Tu es en train de créer une relation plus douce avec toi-même.",
  "Prends le temps de savourer, de respirer, de vivre.",
  "Chaque nouvelle journée te rapproche un peu plus de ton objectif.",
  "Tu es déjà une belle réussite en marche.",
  "Écoute ta faim, respecte ta fatigue, honore ton énergie.",
  "Rien n’est plus puissant qu’une femme qui prend soin d’elle.",
  "Ta motivation peut varier, ton amour pour toi reste.",
  "Tu ne recommences pas à zéro, tu recommences avec de l’expérience.",
  "Garde le cap, la lumière est au bout du chemin.",
  "Ta persévérance mérite d’être applaudie 👏",
  "Sois douce, sois patiente, sois fière.",
];

/** Pas de parcours : premier avec la longueur de la liste, pour alterner les thèmes d'un jour à l'autre. */
function pas(n: number): number {
  const pgcd = (a: number, b: number): number => (b ? pgcd(b, a % b) : a);
  let p = 37;
  while (pgcd(p, n) !== 1) p++;
  return p;
}

/** La phrase du jour (date « AAAA-MM-JJ », heure de Paris) : la même pour toutes, sans répétition sur un tour complet. */
export function encouragementDuJour(jour: string, liste: readonly string[] = ENCOURAGEMENTS): string {
  const n = liste.length;
  const rang = ((joursEntre("2026-01-01", jour) % n) + n) % n;
  return liste[(rang * pas(n)) % n];
}
