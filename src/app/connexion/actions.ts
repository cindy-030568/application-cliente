"use server";

import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/env";
import { createClient, createEmailClient } from "@/lib/supabase/server";

export type EtatConnexion = {
  etape: "email" | "code";
  email?: string;
  erreur?: string;
};

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function actionConnexion(
  _precedent: EtatConnexion,
  formData: FormData,
): Promise<EtatConnexion> {
  const etape = formData.get("etape");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_VALIDE.test(email)) {
    return { etape: "email", email, erreur: "Vérifie ton adresse email." };
  }

  if (etape === "email") {
    const { error } = await createEmailClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${SITE_URL()}/auth/confirm` },
    });
    if (error && error.status === 429) {
      return {
        etape: "email",
        email,
        erreur: "Trop de demandes d'affilée. Patiente une minute avant de réessayer.",
      };
    }
    // Message identique que le compte existe ou non (on ne révèle pas qui est cliente).
    return { etape: "code", email };
  }

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length < 6 || code.length > 8) {
    return { etape: "code", email, erreur: "Le code contient 6 chiffres." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    return {
      etape: "code",
      email,
      erreur: "Ce code ne fonctionne pas ou a expiré. Vérifie-le ou demande un nouveau code.",
    };
  }
  redirect("/");
}
