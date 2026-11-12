"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";

export type EtatReglages = { erreur?: string; succes?: string };

function lienOuNull(valeur: FormDataEntryValue | null): string | null | false {
  const v = String(valeur ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "mailto:" ? u.toString() : false;
  } catch {
    return false;
  }
}

export async function enregistrerReglages(
  _e: EtatReglages,
  formData: FormData,
): Promise<EtatReglages> {
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") {
    return {
      erreur:
        "Action annulée : ce navigateur n’est plus connecté à ton espace coach. Recharge la page et reconnecte-toi. Rien n’a été modifié.",
    };
  }
  const { supabase } = session;
  const lien_formation = lienOuNull(formData.get("lien_formation"));
  const lien_politique = lienOuNull(formData.get("lien_politique"));
  const lien_contact = lienOuNull(formData.get("lien_contact"));
  const message_formation = String(formData.get("message_formation") ?? "").trim().slice(0, 300);

  if (lien_formation === false || lien_politique === false || lien_contact === false) {
    return { erreur: "Un des liens n’est pas valide : il doit commencer par https://" };
  }
  if (!message_formation) return { erreur: "Le message de la carte verrouillée est obligatoire." };

  const { error } = await supabase
    .from("reglages")
    .update({ lien_formation, lien_politique, lien_contact, message_formation })
    .eq("id", true);
  if (error) return { erreur: "L’enregistrement a échoué." };
  revalidatePath("/", "layout");
  return { succes: "Réglages enregistrés." };
}

export async function enregistrerTolerance(_e: EtatReglages, formData: FormData): Promise<EtatReglages> {
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") {
    return { erreur: "Action annulée : ce navigateur n’est plus connecté à ton espace coach. Recharge la page." };
  }
  const tolerance_pct = Number(String(formData.get("tolerance_pct") ?? "").replace(",", "."));
  const tolerance_g = Number(String(formData.get("tolerance_g") ?? "").replace(",", "."));
  const hors_tolerance = formData.get("hors_tolerance") === "badge" ? "badge" : "masquer";
  if (!Number.isFinite(tolerance_pct) || tolerance_pct < 1 || tolerance_pct > 30) {
    return { erreur: "La tolérance en % doit être entre 1 et 30." };
  }
  if (!Number.isFinite(tolerance_g) || tolerance_g < 0 || tolerance_g > 15) {
    return { erreur: "La tolérance en grammes doit être entre 0 et 15." };
  }
  const { error } = await session.supabase
    .from("reglages")
    .update({ tolerance_pct, tolerance_g, hors_tolerance })
    .eq("id", true);
  if (error) return { erreur: "L’enregistrement a échoué." };
  revalidatePath("/", "layout");
  return { succes: "Réglages des recettes enregistrés." };
}
