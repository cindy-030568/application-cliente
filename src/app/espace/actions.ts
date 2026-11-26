"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { lireFormulaireMetabolisme } from "@/lib/metabolisme";
import { exigerAbonnee } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { creerSessionPortail } from "@/lib/stripe";

export type EtatEspace = { erreur?: string };

/** « Gérer mon abonnement » : l'espace sécurisé de Stripe (carte, factures, formule, résiliation). */
export async function gererAbonnement(): Promise<EtatEspace> {
  const { fiche } = await exigerAbonnee();
  if (!fiche.stripe_customer_id) return { erreur: "Ton abonnement est introuvable. Écris-moi, je regarde tout de suite." };
  let url: string;
  try {
    url = await creerSessionPortail(fiche.stripe_customer_id, `${SITE_URL()}/espace/profil`);
  } catch {
    return { erreur: "L’espace de gestion ne s’ouvre pas pour le moment. Réessaie dans un instant." };
  }
  redirect(url);
}

/** Consentement de l'abonnée (même version que les clientes coachées, texte adapté). */
export async function accepterConsentementAbonnee(formData: FormData) {
  if (formData.get("accord") !== "oui") redirect("/espace/bienvenue?manque=1");
  const { supabase, profil, reglages } = await exigerAbonnee(false);
  const { error } = await supabase
    .from("consentements")
    .upsert({ cliente_id: profil.id, version: reglages.version_consentement }, { onConflict: "cliente_id,version", ignoreDuplicates: true });
  if (error) redirect("/espace/bienvenue?erreur=1");
  redirect("/espace");
}

export type EtatMetabolisme = { erreur?: string; succes?: string };

/** « Mon métabolisme » : ses données, gardées pour elle seule (la coach n'y a pas accès). */
export async function enregistrerMetabolisme(_e: EtatMetabolisme, formData: FormData): Promise<EtatMetabolisme> {
  const { supabase, profil } = await exigerAbonnee();
  const champ = (n: string) => String(formData.get(n) ?? "");
  const r = lireFormulaireMetabolisme(
    { annee_naissance: champ("annee_naissance"), taille_cm: champ("taille_cm"), poids_kg: champ("poids_kg"), activite: champ("activite") },
    new Date().getFullYear(),
  );
  if (!r.valeurs) return { erreur: r.erreur };
  const { error } = await supabase.from("metabolisme").upsert({ cliente_id: profil.id, ...r.valeurs, maj_le: new Date().toISOString() }, { onConflict: "cliente_id" });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie dans un instant." };
  revalidatePath("/espace/metabolisme");
  revalidatePath("/espace");
  return { succes: "C’est noté ✓" };
}

/** Mode sans chiffres (poids masqué partout) : l'abonnée le choisit elle-même. */
export async function definirSansChiffresAbonnee(actif: boolean): Promise<EtatEspace> {
  const { supabase } = await exigerAbonnee();
  const { error } = await supabase.rpc("definir_sans_chiffres_abonnee", { p_actif: actif === true });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie dans un instant." };
  revalidatePath("/espace", "layout");
  return {};
}
