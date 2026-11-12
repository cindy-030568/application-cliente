"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { envoyerPush, type AbonnementPush } from "@/lib/envoi-rappels";

const SESSION_EXPIREE = "Ta session a expiré. Reconnecte-toi, puis réessaie.";
export type EtatRappels = { erreur?: string; succes?: string };

async function sessionCliente() {
  const session = await lireSession();
  return session && session.profil.role === "cliente" ? session : null;
}

export async function definirRappelsEmail(actif: boolean): Promise<EtatRappels> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  const { error } = await session.supabase.rpc("definir_rappels_email", { p_actif: actif === true });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/profil");
  return {};
}

type Abonnement = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

export async function enregistrerAppareil(abonnement: Abonnement, appareil: string): Promise<EtatRappels> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  const endpoint = typeof abonnement?.endpoint === "string" ? abonnement.endpoint : "";
  const p256dh = typeof abonnement?.keys?.p256dh === "string" ? abonnement.keys.p256dh : "";
  const auth = typeof abonnement?.keys?.auth === "string" ? abonnement.keys.auth : "";
  if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || p256dh.length > 200 || !auth || auth.length > 100) {
    return { erreur: "Ce téléphone n’a pas pu être enregistré." };
  }
  const { error } = await session.supabase.rpc("enregistrer_abonnement_push", {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_appareil: String(appareil ?? "").slice(0, 60),
  });
  if (error) return { erreur: "Ce téléphone n’a pas pu être enregistré." };
  revalidatePath("/profil");
  return { succes: "Notifications activées sur ce téléphone." };
}

export async function retirerAppareil(endpoint: string): Promise<EtatRappels> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  if (typeof endpoint !== "string" || !endpoint) return {};
  await session.supabase.from("abonnements_push").delete().eq("endpoint", endpoint);
  revalidatePath("/profil");
  return { succes: "Notifications désactivées sur ce téléphone." };
}

export async function testerNotification(): Promise<EtatRappels> {
  const session = await sessionCliente();
  if (!session) return { erreur: SESSION_EXPIREE };
  const { data } = await session.supabase
    .from("abonnements_push")
    .select("id, endpoint, p256dh, auth")
    .eq("cliente_id", session.profil.id)
    .returns<AbonnementPush[]>();
  if (!data?.length) return { erreur: "Active d’abord les notifications sur ce téléphone." };
  let ok = 0;
  for (const a of data) {
    const r = await envoyerPush(a, {
      titre: "fitw_cindy",
      texte: `C’est tout bon${session.profil.prenom ? ` ${session.profil.prenom}` : ""} : tu recevras tes rappels ici 💛`,
      url: "/profil",
    });
    if (r === "ok") ok++;
    if (r === "expire") await session.supabase.from("abonnements_push").delete().eq("id", a.id);
  }
  return ok ? { succes: "Notification envoyée : elle arrive dans quelques secondes." } : { erreur: "La notification n’a pas pu partir. Réessaie plus tard." };
}
