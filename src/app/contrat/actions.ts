"use server";

import { redirect } from "next/navigation";
import { exigerCliente } from "@/lib/auth";

/** La cliente accepte le contrat en cours (les deux cases sont obligatoires, et son adresse / sa date de naissance si le contrat les utilise). */
export async function accepterContrat(formData: FormData) {
  const accepte = formData.get("accepte") === "oui";
  const renonciation = formData.get("renonciation") === "oui";
  if (!accepte || !renonciation) redirect("/contrat?manque=1");
  const { supabase } = await exigerCliente(true, false);
  const version = String(formData.get("version") ?? "").slice(0, 40);
  const adresse = String(formData.get("adresse") ?? "").trim().slice(0, 300) || null;
  const naissance = String(formData.get("date_naissance") ?? "");
  const { data, error } = await supabase.rpc("accepter_contrat", {
    p_version: version,
    p_accepte: accepte,
    p_renonciation: renonciation,
    p_adresse: adresse,
    p_date_naissance: /^\d{4}-\d{2}-\d{2}$/.test(naissance) ? naissance : null,
  });
  if (error) redirect(error.code === "23514" ? "/contrat?infos=1" : "/contrat?erreur=1");
  if (data !== true) redirect("/contrat?change=1");
  redirect("/");
}
