"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/env";
import { COOKIE_RESTER, OPTIONS_COOKIE_PREFERENCE } from "@/lib/session-preference";
import { createClient, createEmailClient } from "@/lib/supabase/server";

export type EtatConnexion = {
  /** « motdepasse » : email + mot de passe ; « email » : demander un code ; « code » : saisir le code reçu. */
  etape: "motdepasse" | "email" | "code";
  email?: string;
  erreur?: string;
};

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function enregistrerPreference(rester: boolean) {
  (await cookies()).set(COOKIE_RESTER, rester ? "1" : "0", OPTIONS_COOKIE_PREFERENCE);
}

export async function actionConnexion(_precedent: EtatConnexion, formData: FormData): Promise<EtatConnexion> {
  // Un bouton « changer de mode » envoie aussi une valeur « etape » : elle est prioritaire.
  const etapes = formData.getAll("etape").map(String);
  const etape = etapes.find((e) => e.startsWith("vers-")) ?? etapes[0] ?? "";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const rester = formData.get("rester") === "on";

  // Changement de mode, sans envoi.
  if (etape === "vers-code") return { etape: "email", email };
  if (etape === "vers-motdepasse") return { etape: "motdepasse", email };

  if (!EMAIL_VALIDE.test(email)) {
    return { etape: etape === "motdepasse" ? "motdepasse" : "email", email, erreur: "Vérifie ton adresse email." };
  }

  if (etape === "motdepasse") {
    const motDePasse = String(formData.get("mot_de_passe") ?? "");
    if (!motDePasse) return { etape: "motdepasse", email, erreur: "Tape ton mot de passe." };
    await enregistrerPreference(rester);
    const supabase = await createClient(rester);
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (error) {
      return {
        etape: "motdepasse",
        email,
        erreur:
          error.status === 429
            ? "Trop d’essais d’affilée. Patiente quelques minutes, ou connecte-toi avec un code."
            : "Email ou mot de passe incorrect. Pas encore de mot de passe ? Connecte-toi avec un code.",
      };
    }
    redirect("/");
  }

  if (etape === "email") {
    const { error } = await createEmailClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${SITE_URL()}/auth/confirm` },
    });
    if (error && error.status === 429) {
      return { etape: "email", email, erreur: "Trop de demandes d’affilée. Patiente une minute avant de réessayer." };
    }
    // Même réponse que le compte existe ou non (on ne révèle pas qui est cliente).
    return { etape: "code", email };
  }

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length < 6 || code.length > 8) {
    return { etape: "code", email, erreur: "Le code contient 6 chiffres." };
  }
  await enregistrerPreference(rester);
  const supabase = await createClient(rester);
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    return {
      etape: "code",
      email,
      erreur: "Ce code ne fonctionne pas ou a expiré. Vérifie-le ou demande un nouveau code.",
    };
  }
  // Pas encore de mot de passe : on propose d'en créer un (facultatif).
  if (!data.user?.user_metadata?.mot_de_passe_defini) redirect("/compte/mot-de-passe?bienvenue=1");
  redirect("/");
}
