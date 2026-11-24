"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { notifierCoach } from "@/lib/notifications-coach";

export type EtatAvis = { erreur?: string; succes?: string };
const SESSION_EXPIREE = "Ta session a expiré. Reconnecte-toi, puis réessaie.";
const NOMS = ["prenom", "initiale", "anonyme"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sessionCliente() {
  const session = await lireSession();
  return session && session.profil.role === "cliente" ? session : null;
}

/** La cliente laisse un témoignage. La publication est une case à part, avec le nom qu'elle choisit. */
export async function laisserAvis(_e: EtatAvis, formData: FormData): Promise<EtatAvis> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  const texte = String(formData.get("texte") ?? "").trim();
  if (texte.length < 10) return { erreur: "Écris quelques mots de plus (10 caractères au moins)." };
  if (texte.length > 2000) return { erreur: "Ton témoignage est un peu long (2 000 caractères au plus)." };
  const publiable = formData.get("publiable") === "on";
  const nom = String(formData.get("nom_affiche") ?? "");
  if (publiable && !NOMS.includes(nom)) return { erreur: "Choisis sous quel nom Cindy peut le publier." };
  const de = String(formData.get("contexte") ?? "");
  const contexte = de === "victoire" || de === "fin" ? de : "libre";
  const { error } = await session.supabase
    .from("avis")
    .insert({ cliente_id: session.profil.id, texte, publiable, nom_affiche: publiable ? nom : null, contexte });
  if (error) return { erreur: error.code === "23514" ? "Tu as déjà laissé beaucoup de témoignages : merci 💛" : "Ça n’a pas fonctionné. Réessaie." };
  const clienteId = session.profil.id;
  after(() => notifierCoach({ type: "avis", clienteId, publiable }));
  revalidatePath("/avis");
  return { succes: "Merci infiniment pour ton témoignage 💛 Il compte énormément pour Cindy." };
}

/** Change d'avis sur la publication (ou la retire). */
export async function changerPublication(id: string, publiable: boolean, nom: string | null): Promise<EtatAvis> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!UUID.test(id) || (publiable && !NOMS.includes(String(nom)))) return { erreur: "Choix invalide." };
  const { error } = await session.supabase
    .from("avis")
    .update({ publiable, nom_affiche: publiable ? nom : null, modifie_le: new Date().toISOString() })
    .eq("id", id)
    .eq("cliente_id", session.profil.id);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/avis");
  return { succes: publiable ? "C’est noté ✓" : "C’est noté : Cindy ne le publiera pas." };
}

export async function supprimerAvis(id: string): Promise<EtatAvis> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (!UUID.test(id)) return { erreur: "Témoignage introuvable." };
  const { error } = await session.supabase.from("avis").delete().eq("id", id).eq("cliente_id", session.profil.id);
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/avis");
  return { succes: "Témoignage retiré." };
}
