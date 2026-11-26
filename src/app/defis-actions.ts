"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION = "Ta session a expiré : reconnecte-toi, puis réessaie.";
export type EtatDefiCliente = { erreur?: string; succes?: string };

async function session() {
  const s = await lireSession();
  return s && s.profil.role !== "coach" ? s : null;
}
function rafraichir() {
  revalidatePath("/defis");
  revalidatePath("/");
  revalidatePath("/espace/bouger");
  revalidatePath("/espace");
}

/** « Je relève le défi » (avec ou sans prénom affiché en cas de réussite). */
export async function releverDefi(defiId: string, afficherPrenom: boolean): Promise<EtatDefiCliente> {
  const s = await session();
  if (!s) return { erreur: SESSION };
  if (!UUID.test(defiId)) return { erreur: "Défi introuvable." };
  const { error } = await s.supabase.from("defis_participations").insert({ defi_id: defiId, afficher_prenom: afficherPrenom === true });
  if (error && error.code !== "23505") return { erreur: "Ce défi n’est pas ouvert en ce moment." };
  rafraichir();
  return { succes: "C’est parti, je suis avec toi 💪" };
}

/** Abandonner (tant que le défi n'est pas réussi). */
export async function quitterDefi(defiId: string): Promise<EtatDefiCliente> {
  const s = await session();
  if (!s) return { erreur: SESSION };
  if (!UUID.test(defiId)) return { erreur: "Défi introuvable." };
  const { error } = await s.supabase.from("defis_participations").delete().eq("defi_id", defiId).eq("cliente_id", s.profil.id);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  rafraichir();
  return { succes: "Tu as quitté le défi. Tu peux le reprendre quand tu veux tant qu’il est en cours." };
}

/** Afficher (ou non) son prénom dans la communauté quand elle réussit. */
export async function afficherPrenomDefi(defiId: string, afficher: boolean): Promise<EtatDefiCliente> {
  const s = await session();
  if (!s) return { erreur: SESSION };
  if (!UUID.test(defiId)) return { erreur: "Défi introuvable." };
  const { error } = await s.supabase.rpc("afficher_prenom_defi", { p_defi: defiId, p_afficher: afficher === true });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  rafraichir();
  return { succes: afficher ? "C’est noté : ton prénom sera fêté dans la communauté quand tu réussiras 🎉" : "C’est noté : ta réussite restera entre nous." };
}
