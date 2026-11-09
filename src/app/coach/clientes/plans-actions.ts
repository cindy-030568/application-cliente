"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { COLONNES_PLAN, type Plan, type SourcePlan, type TypePlan } from "@/lib/types";
import { UUID, verifierCliente } from "./verification";

export type EtatPlan = { erreur?: string; succes?: string };

const TYPES: TypePlan[] = ["nutrition", "sport"];
const SOURCES: SourcePlan[] = ["pdf", "drive", "nutrium"];

/** Étape 1 du dépôt d'un PDF : autorisation d'envoi direct vers le stockage privé. */
export async function preparerDepotPdf(
  clienteId: string,
  type: TypePlan,
): Promise<{ erreur?: string; chemin?: string; jeton?: string }> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!TYPES.includes(type)) return { erreur: "Type de plan inconnu." };

  const chemin = `${clienteId}/${type}/${randomUUID()}.pdf`;
  const { data, error } = await v.supabase.storage.from("plans").createSignedUploadUrl(chemin);
  if (error || !data) return { erreur: "Le dépôt n’a pas pu être préparé. Réessaie dans un instant." };
  return { chemin: data.path, jeton: data.token };
}

/** Étape 2 : enregistre la nouvelle version (l'ancienne passe dans l'historique). */
export async function publierPlan(
  clienteId: string,
  type: TypePlan,
  _e: EtatPlan,
  formData: FormData,
): Promise<EtatPlan> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!TYPES.includes(type)) return { erreur: "Type de plan inconnu." };

  const source = String(formData.get("source") ?? "") as SourcePlan;
  if (!SOURCES.includes(source) || (source === "nutrium" && type !== "nutrition")) {
    return { erreur: "Choisis comment partager le plan." };
  }

  const dateDuJour = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(new Date());
  const titre =
    String(formData.get("titre") ?? "").trim().slice(0, 120) ||
    `${type === "nutrition" ? "Plan alimentaire" : "Programme sportif"} du ${dateDuJour}`;

  let fichier: string | null = null;
  let url: string | null = null;

  if (source === "pdf") {
    fichier = String(formData.get("chemin") ?? "");
    const prefixe = `${clienteId}/${type}/`;
    if (!fichier.startsWith(prefixe) || !/^[0-9a-f-]{36}\.pdf$/.test(fichier.slice(prefixe.length))) {
      return { erreur: "Le fichier PDF est introuvable. Recommence le dépôt." };
    }
  } else {
    const brut = String(formData.get("url") ?? "").trim();
    try {
      const u = new URL(brut);
      if (u.protocol !== "https:") throw new Error();
      url = u.toString();
    } catch {
      return { erreur: "Le lien doit commencer par https://" };
    }
  }

  const { error } = await v.supabase.rpc("publier_plan", {
    p_cliente: clienteId,
    p_type: type,
    p_source: source,
    p_titre: titre,
    p_fichier: fichier,
    p_url: url,
  });
  if (error) {
    if (fichier) await v.supabase.storage.from("plans").remove([fichier]);
    return { erreur: "Le plan n’a pas pu être enregistré. Réessaie dans un instant." };
  }

  revalidatePath(`/coach/clientes/${clienteId}`);
  return { succes: "Nouveau plan publié. Elle le verra dès sa prochaine ouverture de l’app." };
}

/** Supprime une version. Si c'était la version actuelle, la précédente redevient actuelle. */
export async function supprimerPlan(clienteId: string, planId: string): Promise<EtatPlan> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(planId)) return { erreur: "Plan introuvable." };

  const { data: plan } = await v.supabase
    .from("plans")
    .select(COLONNES_PLAN)
    .eq("id", planId)
    .eq("cliente_id", clienteId)
    .maybeSingle<Plan>();
  if (!plan) return { erreur: "Plan introuvable." };

  const { error } = await v.supabase.from("plans").delete().eq("id", planId);
  if (error) return { erreur: "La suppression a échoué." };
  if (plan.fichier_path) await v.supabase.storage.from("plans").remove([plan.fichier_path]);

  if (plan.actif) {
    const { data: precedent } = await v.supabase
      .from("plans")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("type", plan.type)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (precedent) await v.supabase.from("plans").update({ actif: true }).eq("id", precedent.id);
  }

  revalidatePath(`/coach/clientes/${clienteId}`);
  return { succes: "Version supprimée." };
}

/** Lien temporaire (5 min) pour que la coach ouvre un PDF. */
export async function lienPlanCoach(
  clienteId: string,
  planId: string,
): Promise<{ erreur?: string; url?: string }> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(planId)) return { erreur: "Plan introuvable." };
  const { data: plan } = await v.supabase
    .from("plans")
    .select("fichier_path, url")
    .eq("id", planId)
    .eq("cliente_id", clienteId)
    .maybeSingle<{ fichier_path: string | null; url: string | null }>();
  if (!plan) return { erreur: "Plan introuvable." };
  if (plan.url) return { url: plan.url };
  const { data } = await v.supabase.storage.from("plans").createSignedUrl(plan.fichier_path!, 300);
  return data ? { url: data.signedUrl } : { erreur: "Le fichier est introuvable." };
}
