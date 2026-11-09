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
