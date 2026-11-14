/**
 * Rappels de bilan : quel rappel envoyer aujourd'hui à une cliente, et son texte.
 * Module pur, sans base de données ni envoi : entièrement testable.
 */
import { joursEntre, echeanceOuverte } from "@/lib/bilan";

export type TypeRappel = "ouverture" | "relance";

export type SituationRappel = {
  statut: string;
  date_debut: string | null;
  frequence_bilan_jours: number;
  /** Jours d'ouverture du bilan avant l'échéance (réglage de la coach). */
  fenetre: number;
  /** Jours après le premier rappel pour relancer (0 = pas de relance). */
  relanceJours: number;
  aujourdhui: string;
  /** Échéances pour lesquelles un bilan a déjà été envoyé. */
  bilansEnvoyes: Set<string>;
  /** Rappels déjà envoyés, par « échéance|type » → date d'envoi (AAAA-MM-JJ, heure de Paris). */
  rappelsEnvoyes: Map<string, string>;
};

export const cleRappel = (echeance: string, type: TypeRappel) => `${echeance}|${type}`;

/**
 * Le rappel à envoyer aujourd'hui, ou null. Au plus un par jour :
 * - « ouverture » dès que le bilan est ouvert (même en retard, si rien n'a encore été envoyé) ;
 * - « relance » `relanceJours` après le premier rappel, tant que le bilan peut encore être envoyé.
 * Jamais pour une cliente qui n'est pas active, ni pour un bilan déjà envoyé.
 */
export function rappelDu(s: SituationRappel): { echeance: string; type: TypeRappel } | null {
  if (s.statut !== "active") return null;
  const e = echeanceOuverte(s.date_debut, s.frequence_bilan_jours, s.fenetre, s.aujourdhui);
  if (!e || s.bilansEnvoyes.has(e.echeance)) return null;
  const ouverture = s.rappelsEnvoyes.get(cleRappel(e.echeance, "ouverture"));
  if (!ouverture) return { echeance: e.echeance, type: "ouverture" };
  if (s.relanceJours < 1 || s.rappelsEnvoyes.has(cleRappel(e.echeance, "relance"))) return null;
  if (joursEntre(ouverture, s.aujourdhui) >= s.relanceJours) return { echeance: e.echeance, type: "relance" };
  return null;
}

/** Remplace {prenom} dans le texte choisi par la coach. */
export function personnaliser(texte: string, prenom: string): string {
  return texte.replaceAll("{prenom}", prenom.trim() || "toi").trim();
}

export const SUJETS: Record<TypeRappel, string> = {
  ouverture: "Ton bilan est prêt 🌿",
  relance: "Petit rappel : ton bilan t’attend",
};

const echapper = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Email de rappel aux couleurs de l'app (HTML simple, compatible avec les messageries). */
export function emailRappel(
  message: string,
  lien: string,
  lienProfil: string,
  bouton = "Faire mon bilan",
): { html: string; texte: string } {
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:0;background:#f5ecd7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5ecd7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffaf0;border-radius:20px;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;color:#3b2314;">
<tr><td style="font-family:Georgia,serif;font-size:22px;font-weight:bold;padding-bottom:20px;">fitw<span style="color:#c17f3a;">_</span>cindy</td></tr>
<tr><td style="font-size:17px;line-height:1.55;padding-bottom:28px;">${echapper(message)}</td></tr>
<tr><td><a href="${echapper(lien)}" style="display:inline-block;background:#d6336c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 28px;border-radius:999px;">${echapper(bouton)}</a></td></tr>
<tr><td style="font-size:12.5px;line-height:1.5;color:#6e5440;padding-top:32px;">Tu reçois cet email car tu es accompagnée par Cindy. Pour ne plus recevoir les rappels par email : <a href="${echapper(lienProfil)}" style="color:#6e5440;">ton profil</a>.</td></tr>
</table></td></tr></table></body></html>`;
  const texte = `${message}\n\n${bouton} : ${lien}\n\nPour ne plus recevoir ces emails : ${lienProfil}`;
  return { html, texte };
}
