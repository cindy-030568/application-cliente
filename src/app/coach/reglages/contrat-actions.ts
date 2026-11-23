"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import type { EtatReglages } from "./actions";

const SESSION = "Action annulée : ce navigateur n’est plus connecté à ton espace coach. Recharge la page et reconnecte-toi.";

/** Enregistre le contrat (texte + version) et la phrase de la case de renonciation. */
export async function enregistrerContrat(_e: EtatReglages, formData: FormData): Promise<EtatReglages> {
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") return { erreur: SESSION };
  const { supabase } = session;
  const texte = String(formData.get("contrat_texte") ?? "").replace(/\r\n/g, "\n").trim();
  const version = String(formData.get("contrat_version") ?? "").trim();
  const renonciation = String(formData.get("contrat_case_renonciation") ?? "").trim();
  if (texte.length > 100_000) return { erreur: "Le contrat est trop long (100 000 caractères au plus)." };
  if (texte && (!version || version.length > 40)) return { erreur: "Donne un numéro de version au contrat (par exemple « 1 » ou « 2026-12 »)." };
  if (texte && !renonciation) return { erreur: "Écris la phrase de la case de renonciation au droit de rétractation." };
  if (renonciation.length > 2000) return { erreur: "La phrase de la case de renonciation est trop longue." };

  const { data: actuel, error: sans0027 } = await supabase
    .from("reglages")
    .select("contrat_texte, contrat_version, contrat_case_renonciation, contrat_depuis")
    .single<{ contrat_texte: string | null; contrat_version: string | null; contrat_case_renonciation: string | null; contrat_depuis: string | null }>();
  if (sans0027 || !actuel) return { erreur: "Fais d’abord la mise à jour 0027 dans Supabase (voir le guide)." };

  // Une version déjà acceptée ne change plus : la preuve doit correspondre à ce qu'elle a lu.
  const modifie = texte !== (actuel.contrat_texte ?? "") || renonciation !== (actuel.contrat_case_renonciation ?? "");
  if (modifie && version && version === actuel.contrat_version) {
    const { count } = await supabase.from("acceptations_contrat").select("id", { count: "exact", head: true }).eq("version", version);
    if (count) {
      return {
        erreur: `La version « ${version} » a déjà été acceptée par ${count} cliente${count > 1 ? "s" : ""} : change le numéro de version pour enregistrer un nouveau texte.`,
      };
    }
  }

  const { error } = await supabase
    .from("reglages")
    .update({
      contrat_texte: texte || null,
      contrat_version: texte ? version : null,
      contrat_case_renonciation: texte ? renonciation : null,
      contrat_depuis: texte ? (actuel.contrat_depuis ?? new Date().toISOString()) : actuel.contrat_depuis,
    })
    .eq("id", true);
  if (error) return { erreur: "L’enregistrement a échoué." };
  revalidatePath("/coach/reglages");
  return {
    succes: texte
      ? `Contrat version « ${version} » enregistré : les nouvelles clientes l’accepteront à leur première connexion.`
      : "Contrat retiré : plus aucune cliente ne le verra.",
  };
}

/** Active ou coupe le bouton « Proposer un brouillon » (Claude) sur les bilans. */
export async function changerBrouillonClaude(actif: boolean): Promise<EtatReglages> {
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") return { erreur: SESSION };
  const { error } = await session.supabase.from("reglages").update({ brouillon_claude: actif === true }).eq("id", true);
  if (error) return { erreur: "Ça n’a pas fonctionné. As-tu fait la mise à jour 0028 dans Supabase ?" };
  revalidatePath("/coach", "layout");
  return { succes: actif ? "Brouillons Claude activés." : "Brouillons Claude désactivés." };
}
