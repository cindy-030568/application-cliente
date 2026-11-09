"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { lireSession } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEmailClient } from "@/lib/supabase/server";
import type { StatutCliente } from "@/lib/types";

export type EtatAction = { erreur?: string; succes?: string; lien?: string };

const SESSION_PERDUE =
  "Action annulée : ce navigateur n’est plus connecté à ton espace coach (une connexion cliente l’a sans doute remplacé). Recharge la page et reconnecte-toi avec ton email. Rien n’a été modifié.";

/** Session coach, ou null (au lieu de rediriger : on affiche un message clair). */
async function sessionCoach() {
  const session = await lireSession();
  return session && session.profil.role === "coach" ? session : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function texte(formData: FormData, cle: string, max = 120) {
  return String(formData.get(cle) ?? "").trim().slice(0, max);
}
function dateOuNull(formData: FormData, cle: string) {
  const v = texte(formData, cle, 10);
  return DATE.test(v) ? v : null;
}

function lireInfos(formData: FormData) {
  const prenom = texte(formData, "prenom", 60);
  const nom = texte(formData, "nom", 80);
  const email = texte(formData, "email", 200).toLowerCase();
  const date_debut = dateOuNull(formData, "date_debut");
  const date_fin = dateOuNull(formData, "date_fin");
  const frequence = Number(texte(formData, "frequence_bilan_jours", 3) || 14);
  const acces_formation = formData.get("acces_formation") === "on";
  const masquer_graph_poids = formData.get("masquer_graph_poids") === "on";

  let erreur: string | undefined;
  if (!prenom) erreur = "Le prénom est obligatoire.";
  else if (!EMAIL.test(email)) erreur = "L’adresse email n’est pas valide.";
  else if (!Number.isInteger(frequence) || frequence < 1 || frequence > 120)
    erreur = "La fréquence des bilans doit être comprise entre 1 et 120 jours.";
  else if (date_debut && date_fin && date_fin < date_debut)
    erreur = "La date de fin doit être après la date de début.";

  return {
    erreur,
    profil: { prenom, nom, email },
    fiche: { date_debut, date_fin, frequence_bilan_jours: frequence, acces_formation, masquer_graph_poids },
  };
}

/** Vérifie la session coach et que l'identifiant désigne bien une cliente (jamais le compte coach). */
async function verifierCliente(id: string) {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE } as const;
  if (!UUID.test(id)) return { erreur: "Cliente introuvable." } as const;
  const { data } = await session.supabase
    .from("clientes")
    .select("id, profils!inner(email, prenom)")
    .eq("id", id)
    .maybeSingle<{ id: string; profils: { email: string; prenom: string } }>();
  if (!data) return { erreur: "Cliente introuvable." } as const;
  return { ...session, email: data.profils.email, prenom: data.profils.prenom, erreur: undefined };
}

async function envoyerEmail(email: string) {
  return createEmailClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${SITE_URL()}/auth/confirm` },
  });
}

export async function creerCliente(_e: EtatAction, formData: FormData): Promise<EtatAction> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const { supabase } = session;
  const { erreur, profil, fiche } = lireInfos(formData);
  if (erreur) return { erreur };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: profil.email,
    email_confirm: true,
    user_metadata: { prenom: profil.prenom, nom: profil.nom },
  });
  if (error || !data.user) {
    const existe = error?.code === "email_exists" || error?.status === 422;
    return {
      erreur: existe
        ? "Un compte existe déjà avec cette adresse email."
        : "La création du compte a échoué. Réessaie dans un instant.",
    };
  }

  const id = data.user.id;
  const { error: erreurFiche } = await supabase.from("clientes").insert({ id, ...fiche });
  if (erreurFiche) {
    await admin.auth.admin.deleteUser(id);
    return { erreur: "La fiche cliente n’a pas pu être créée. Réessaie dans un instant." };
  }

  let suite = "creee=1";
  if (formData.get("envoyer_email") === "on") {
    const { error: erreurEmail } = await envoyerEmail(profil.email);
    suite = erreurEmail ? "creee=1&email=echec" : "creee=1&email=ok";
  }
  revalidatePath("/coach", "layout");
  redirect(`/coach/clientes/${id}?${suite}`);
}

export async function modifierCliente(
  id: string,
  _e: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  const v = await verifierCliente(id);
  if (v.erreur) return { erreur: v.erreur };
  const { supabase, email: emailActuel } = v;
  const { erreur, profil, fiche } = lireInfos(formData);
  if (erreur) return { erreur };

  if (profil.email !== emailActuel.toLowerCase()) {
    const { error } = await createAdminClient().auth.admin.updateUserById(id, {
      email: profil.email,
      email_confirm: true,
    });
    if (error) return { erreur: "Cette adresse email est déjà utilisée ou invalide." };
  }

  const { error: e1 } = await supabase.from("profils").update(profil).eq("id", id);
  const { error: e2 } = await supabase.from("clientes").update(fiche).eq("id", id);
  if (e1 || e2) return { erreur: "L’enregistrement a échoué. Réessaie dans un instant." };

  revalidatePath("/coach", "layout");
  return { succes: "Modifications enregistrées." };
}

export async function changerStatut(id: string, statut: StatutCliente): Promise<EtatAction> {
  const v = await verifierCliente(id);
  if (v.erreur) return { erreur: v.erreur };
  const { supabase } = v;
  if (!["active", "terminee", "fermee"].includes(statut)) return { erreur: "Statut inconnu." };

  const { error } = await supabase
    .from("clientes")
    .update({
      statut,
      ferme_le: statut === "fermee" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id);
  if (error) return { erreur: "Le statut n’a pas pu être modifié." };

  // Accès fermé : le compte est bloqué côté authentification (plus aucune connexion).
  await createAdminClient().auth.admin.updateUserById(id, {
    ban_duration: statut === "fermee" ? "876000h" : "none",
  });

  revalidatePath("/coach", "layout");
  return { succes: "Statut mis à jour." };
}

export async function envoyerEmailConnexion(id: string): Promise<EtatAction> {
  const v = await verifierCliente(id);
  if (v.erreur) return { erreur: v.erreur };
  const { email } = v;
  const { error } = await envoyerEmail(email);
  if (error) {
    return {
      erreur:
        error.status === 429
          ? "Trop d’emails envoyés récemment. Réessaie dans quelques minutes, ou utilise le lien à copier."
          : "L’email n’a pas pu partir. Utilise le lien à copier en attendant.",
    };
  }
  return { succes: `Email de connexion envoyé à ${email}.` };
}

export async function genererLienConnexion(id: string): Promise<EtatAction> {
  const v = await verifierCliente(id);
  if (v.erreur) return { erreur: v.erreur };
  const { email } = v;
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return { erreur: "Le lien n’a pas pu être créé." };
  return {
    lien: `${SITE_URL()}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=magiclink`,
  };
}

export async function ajouterNote(id: string, _e: EtatAction, formData: FormData): Promise<EtatAction> {
  const v = await verifierCliente(id);
  if (v.erreur) return { erreur: v.erreur };
  const { supabase } = v;
  const contenu = String(formData.get("contenu") ?? "").trim().slice(0, 10000);
  if (!contenu) return { erreur: "La note est vide." };
  const { error } = await supabase.from("notes_coach").insert({ cliente_id: id, contenu });
  if (error) return { erreur: "La note n’a pas pu être enregistrée." };
  revalidatePath(`/coach/clientes/${id}`);
  return { succes: "Note ajoutée." };
}

export async function supprimerNote(id: string, noteId: string): Promise<EtatAction> {
  const v = await verifierCliente(id);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(noteId)) return { erreur: "Note introuvable." };
  const { error } = await v.supabase.from("notes_coach").delete().eq("id", noteId).eq("cliente_id", id);
  if (error) return { erreur: "La note n’a pas pu être supprimée." };
  revalidatePath(`/coach/clientes/${id}`);
  return {};
}

export async function supprimerCliente(
  id: string,
  _e: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  const v = await verifierCliente(id);
  if (v.erreur) return { erreur: v.erreur };
  const { prenom } = v;
  const saisie = String(formData.get("confirmation") ?? "").trim();
  if (saisie.toLowerCase() !== (prenom || "supprimer").toLowerCase()) {
    return { erreur: `Tape « ${prenom || "supprimer"} » pour confirmer.` };
  }
  // Supprime le compte : profil, fiche, notes et consentements partent en cascade.
  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) return { erreur: "La suppression a échoué. Réessaie dans un instant." };
  revalidatePath("/coach", "layout");
  redirect("/coach/clientes?supprimee=1");
}
