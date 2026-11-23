"use server";

import { redirect } from "next/navigation";
import { exigerCliente } from "@/lib/auth";

/** La cliente accepte le contrat en cours (les deux cases sont obligatoires). */
export async function accepterContrat(formData: FormData) {
  const accepte = formData.get("accepte") === "oui";
  const renonciation = formData.get("renonciation") === "oui";
  if (!accepte || !renonciation) redirect("/contrat?manque=1");
  const { supabase } = await exigerCliente(true, false);
  const version = String(formData.get("version") ?? "").slice(0, 40);
  const { data, error } = await supabase.rpc("accepter_contrat", { p_version: version, p_accepte: accepte, p_renonciation: renonciation });
  if (error) redirect("/contrat?erreur=1");
  if (data !== true) redirect("/contrat?change=1");
  redirect("/");
}
