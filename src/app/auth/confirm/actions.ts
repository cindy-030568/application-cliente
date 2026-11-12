"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function confirmerConnexion(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "");
  if (!tokenHash || !["email", "magiclink"].includes(type)) {
    redirect("/auth/confirm?erreur=1");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });
  if (error) redirect("/auth/confirm?erreur=1");
  // Pas encore de mot de passe : on propose d'en créer un (facultatif).
  if (!data.user?.user_metadata?.mot_de_passe_defini) redirect("/compte/mot-de-passe?bienvenue=1");
  redirect("/");
}
