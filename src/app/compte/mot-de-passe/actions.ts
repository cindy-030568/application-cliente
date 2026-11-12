"use server";

import { redirect } from "next/navigation";
import { lireSession } from "@/lib/auth";

export type EtatMotDePasse = { erreur?: string; succes?: string };

export async function definirMotDePasse(_e: EtatMotDePasse, formData: FormData): Promise<EtatMotDePasse> {
  const session = await lireSession();
  if (!session) redirect("/connexion");
  const mdp = String(formData.get("mot_de_passe") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (mdp.length < 8) return { erreur: "Ton mot de passe doit contenir au moins 8 caractères." };
  if (mdp.length > 72) return { erreur: "Ton mot de passe est trop long (72 caractères maximum)." };
  if (mdp !== confirmation) return { erreur: "Les deux mots de passe ne sont pas identiques." };

  const { error } = await session.supabase.auth.updateUser({ password: mdp, data: { mot_de_passe_defini: true } });
  if (error) {
    if (error.code === "same_password") return { erreur: "C’est déjà ton mot de passe actuel." };
    if (error.code === "weak_password") return { erreur: "Ce mot de passe est trop simple : mélange lettres et chiffres." };
    if (error.code === "reauthentication_needed")
      return { erreur: "Par sécurité, reconnecte-toi avec un code par email, puis réessaie." };
    return { erreur: "Le mot de passe n’a pas pu être enregistré. Réessaie dans un instant." };
  }
  return { succes: "C’est enregistré ! La prochaine fois, connecte-toi avec ton email et ce mot de passe." };
}
