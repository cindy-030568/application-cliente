"use server";

import { redirect } from "next/navigation";
import { exigerCliente } from "@/lib/auth";

export async function accepterConsentement(formData: FormData) {
  if (formData.get("accord") !== "oui") redirect("/consentement?manque=1");
  const { supabase, profil, reglages } = await exigerCliente(false);
  const { error } = await supabase
    .from("consentements")
    .upsert(
      { cliente_id: profil.id, version: reglages.version_consentement },
      { onConflict: "cliente_id,version", ignoreDuplicates: true },
    );
  if (error) redirect("/consentement?erreur=1");
  redirect("/");
}
