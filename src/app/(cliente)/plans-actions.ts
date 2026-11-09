"use server";

import { exigerCliente } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function marquerPlanVu(planId: string) {
  if (!UUID.test(planId)) return;
  const { supabase } = await exigerCliente();
  await supabase.rpc("marquer_plan_vu", { plan_id: planId });
}

/** Lien de téléchargement valable 1 minute (la RLS garantit que c'est bien SON plan). */
export async function lienTelechargementPlan(
  planId: string,
): Promise<{ url?: string; erreur?: string }> {
  if (!UUID.test(planId)) return { erreur: "Plan introuvable." };
  const { supabase } = await exigerCliente();
  const { data: plan } = await supabase
    .from("plans")
    .select("titre, fichier_path")
    .eq("id", planId)
    .maybeSingle<{ titre: string; fichier_path: string | null }>();
  if (!plan?.fichier_path) return { erreur: "Plan introuvable." };
  const nom = plan.titre.replace(/[\\/:*?"<>|]+/g, " ").trim() || "plan";
  const { data } = await supabase.storage
    .from("plans")
    .createSignedUrl(plan.fichier_path, 60, { download: `${nom}.pdf` });
  return data ? { url: data.signedUrl } : { erreur: "Le téléchargement n’est pas disponible." };
}
