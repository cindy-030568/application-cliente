"use server";

import { revalidatePath } from "next/cache";
import { envoyerAnnonce } from "@/lib/envoi-rappels";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_PERDUE, UUID, sessionCoach } from "./clientes/verification";

export type EtatAnnonce = { erreur?: string; succes?: string };
const LIENS = ["/communaute", "/suivi/journal", "/recettes", "/ressources", "/suivi"];

export async function publierAnnonce(_e: EtatAnnonce, formData: FormData): Promise<EtatAnnonce> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  const texte = String(formData.get("texte") ?? "").trim().slice(0, 300);
  const lienBrut = String(formData.get("lien") ?? "");
  const lien = LIENS.includes(lienBrut) ? lienBrut : null;
  if (!texte) return { erreur: "Écris ton message." };
  const { error } = await session.supabase.from("annonces").insert({ texte, lien });
  if (error) return { erreur: "L’annonce n’a pas pu être publiée. As-tu fait la mise à jour 0014 dans Supabase ?" };
  let notif = { clientes: 0, notifications: 0 };
  if (formData.get("notifier") === "on" && process.env.SUPABASE_SECRET_KEY) {
    try {
      notif = await envoyerAnnonce(createAdminClient(), texte, lien ?? "/");
    } catch {
      /* le bandeau est publié même si l'envoi échoue */
    }
  }
  revalidatePath("/coach");
  revalidatePath("/");
  return {
    succes:
      `Publié ✓ Le message reste 24 h sur l’accueil de tes clientes.` +
      (formData.get("notifier") === "on"
        ? ` Notification reçue par ${notif.clientes} cliente${notif.clientes > 1 ? "s" : ""} (celles qui les ont activées).`
        : ""),
  };
}

export async function retirerAnnonce(id: string): Promise<EtatAnnonce> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(String(id))) return { erreur: "Annonce introuvable." };
  await session.supabase.from("annonces").update({ expire_le: new Date().toISOString() }).eq("id", id);
  revalidatePath("/coach");
  revalidatePath("/");
  return {};
}
