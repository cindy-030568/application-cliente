"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { aujourdhuiParis, echeanceOuverte } from "@/lib/bilan";
import { chargerChamps } from "@/lib/suivi";
import { COLONNES_FICHE, type AnglePhoto, type FicheCliente } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANGLES: AnglePhoto[] = ["face", "profil", "dos"];

export type EtatBilan = { erreur?: string; bilanId?: string };

/**
 * Contexte d'une action de suivi : la cliente elle-même, ou la coach agissant
 * pour une cliente. Renvoie la fiche de la cliente concernée.
 */
async function contexte(clienteCible: string | null) {
  const session = await lireSession();
  if (!session) return { erreur: "Ta session a expiré. Reconnecte-toi, puis réessaie." } as const;
  const coach = session.profil.role === "coach";
  const clienteId = coach ? clienteCible : session.profil.id;
  if (!clienteId || !UUID.test(clienteId)) return { erreur: "Cliente introuvable." } as const;
  const { data: fiche } = await session.supabase
    .from("clientes")
    .select(COLONNES_FICHE)
    .eq("id", clienteId)
    .maybeSingle<FicheCliente>();
  if (!fiche || fiche.statut === "fermee") return { erreur: "Ce suivi n’est pas accessible." } as const;
  return { ...session, coach, clienteId, fiche, erreur: undefined };
}

function rafraichir(clienteId: string, bilanId?: string) {
  revalidatePath("/suivi");
  revalidatePath("/");
  if (bilanId) revalidatePath(`/suivi/${bilanId}`);
  revalidatePath(`/coach/clientes/${clienteId}/suivi`);
  revalidatePath("/coach/bilans");
  revalidatePath("/coach");
}

function lireNombre(brut: string): number | null {
  const v = brut.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export async function enregistrerBilan(
  clienteCible: string | null,
  bilanId: string | null,
  _e: EtatBilan,
  formData: FormData,
): Promise<EtatBilan> {
  const ctx = await contexte(clienteCible);
  if (ctx.erreur) return { erreur: ctx.erreur };
  const { supabase, clienteId, fiche } = ctx;

  const aujourdhui = aujourdhuiParis();
  const date = String(formData.get("date_mesure") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > aujourdhui || date < "2020-01-01") {
    return { erreur: "La date du bilan n’est pas valide." };
  }
  const aCommentaire = formData.has("commentaire");
  const commentaire = String(formData.get("commentaire") ?? "").trim().slice(0, 3000) || null;

  // Seuls les champs affichés dans le formulaire sont remplacés (les autres réponses sont conservées).
  const presentes = new Set(String(formData.get("champs_presentes") ?? "").split(",").filter(Boolean));
  const champs = (await chargerChamps(supabase)).filter(
    (c) => presentes.has(c.id) && !(fiche.mode_sans_chiffres && c.groupe === "mesure"),
  );
  const valeurs: { champ_id: string; valeur_num: number | null; valeur_texte: string | null; precision: string | null }[] = [];
  for (const champ of champs) {
    const brut = String(formData.get(`champ_${champ.id}`) ?? "").trim();
    const precision = champ.avec_precision
      ? String(formData.get(`precision_${champ.id}`) ?? "").trim().slice(0, 1000) || null
      : null;
    let valeur_num: number | null = null;
    let valeur_texte: string | null = null;
    if (brut) {
      if (champ.type === "texte") {
        valeur_texte = brut.slice(0, 2000);
      } else if (champ.type === "choix") {
        if (!champ.options?.includes(brut)) return { erreur: "Une réponse n’est pas valide. Recharge la page et réessaie." };
        valeur_texte = brut;
      } else {
        const n = lireNombre(brut);
        const max = champ.type === "echelle" ? 10 : 999;
        const min = champ.type === "echelle" ? 1 : 0.1;
        if (n !== null && (Number.isNaN(n) || n < min || n > max)) {
          return { erreur: `La valeur de « ${champ.libelle.replace(/\{jours\}/g, "…")} » n’est pas valide.` };
        }
        valeur_num = n === null ? null : Math.round(n * 100) / 100;
      }
    }
    if (valeur_num !== null || valeur_texte !== null || precision !== null) {
      valeurs.push({ champ_id: champ.id, valeur_num, valeur_texte, precision });
    }
  }
  if (valeurs.length === 0 && !commentaire) {
    return { erreur: "Ton bilan est vide : réponds au moins à une question." };
  }

  let id = bilanId;
  if (id) {
    if (!UUID.test(id)) return { erreur: "Bilan introuvable." };
    const { data, error } = await supabase
      .from("bilans")
      .update(aCommentaire ? { date_mesure: date, commentaire } : { date_mesure: date })
      .eq("id", id)
      .eq("cliente_id", clienteId)
      .select("id")
      .maybeSingle();
    if (error || !data) return { erreur: "Ce bilan ne peut pas être modifié." };
  } else {
    const { data: reglages } = await supabase.from("reglages").select("fenetre_bilan_jours").single();
    const ouverte = echeanceOuverte(
      fiche.date_debut,
      fiche.frequence_bilan_jours,
      reglages?.fenetre_bilan_jours ?? 3,
      aujourdhui,
    );
    let echeance: string | null = null;
    if (ouverte) {
      const { data: existant } = await supabase
        .from("bilans")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("echeance", ouverte.echeance)
        .maybeSingle();
      if (!existant) echeance = ouverte.echeance;
    }
    const { data, error } = await supabase
      .from("bilans")
      .insert({ cliente_id: clienteId, date_mesure: date, commentaire, echeance })
      .select("id")
      .single();
    if (error || !data) return { erreur: "Le bilan n’a pas pu être enregistré. Réessaie dans un instant." };
    id = data.id as string;
  }

  // Remplace les valeurs des champs proposés dans le formulaire (les champs masqués gardent leur historique).
  const idsChamps = champs.map((c) => c.id);
  if (idsChamps.length) {
    await supabase.from("bilan_valeurs").delete().eq("bilan_id", id).in("champ_id", idsChamps);
  }
  if (valeurs.length) {
    const { error } = await supabase
      .from("bilan_valeurs")
      .insert(valeurs.map((v) => ({ ...v, bilan_id: id })));
    if (error) return { erreur: "Les mesures n’ont pas pu être enregistrées.", bilanId: id! };
  }

  rafraichir(clienteId, id!);
  return { bilanId: id! };
}

async function bilanAccessible(bilanId: string) {
  const session = await lireSession();
  if (!session || !UUID.test(bilanId)) return null;
  const { data } = await session.supabase
    .from("bilans")
    .select("id, cliente_id")
    .eq("id", bilanId)
    .maybeSingle<{ id: string; cliente_id: string }>();
  return data ? { ...session, bilan: data } : null;
}

export async function preparerDepotPhoto(
  bilanId: string,
  angle: AnglePhoto,
): Promise<{ erreur?: string; chemin?: string; jeton?: string }> {
  const ctx = await bilanAccessible(bilanId);
  if (!ctx || !ANGLES.includes(angle)) return { erreur: "Photo impossible à envoyer." };
  const chemin = `${ctx.bilan.cliente_id}/${bilanId}/${angle}-${randomUUID()}.jpg`;
  const { data, error } = await ctx.supabase.storage.from("photos").createSignedUploadUrl(chemin);
  if (error || !data) return { erreur: "L’envoi de la photo n’a pas pu être préparé." };
  return { chemin: data.path, jeton: data.token };
}

export async function confirmerPhoto(bilanId: string, angle: AnglePhoto, chemin: string) {
  const ctx = await bilanAccessible(bilanId);
  if (!ctx || !ANGLES.includes(angle)) return { erreur: "Photo introuvable." };
  const prefixe = `${ctx.bilan.cliente_id}/${bilanId}/${angle}-`;
  if (!chemin.startsWith(prefixe) || !/^[0-9a-f-]{36}\.jpg$/.test(chemin.slice(prefixe.length))) {
    return { erreur: "Photo introuvable." };
  }
  const { data: ancienne } = await ctx.supabase
    .from("photos_bilan")
    .select("id, fichier_path")
    .eq("bilan_id", bilanId)
    .eq("angle", angle)
    .maybeSingle();
  if (ancienne) {
    await ctx.supabase.from("photos_bilan").delete().eq("id", ancienne.id);
    await ctx.supabase.storage.from("photos").remove([ancienne.fichier_path]);
  }
  const { error } = await ctx.supabase
    .from("photos_bilan")
    .insert({ bilan_id: bilanId, cliente_id: ctx.bilan.cliente_id, angle, fichier_path: chemin });
  if (error) return { erreur: "La photo n’a pas pu être enregistrée." };
  rafraichir(ctx.bilan.cliente_id, bilanId);
  return {};
}

export async function supprimerPhoto(bilanId: string, angle: AnglePhoto) {
  const ctx = await bilanAccessible(bilanId);
  if (!ctx || !ANGLES.includes(angle)) return { erreur: "Photo introuvable." };
  const { data: photo } = await ctx.supabase
    .from("photos_bilan")
    .select("id, fichier_path")
    .eq("bilan_id", bilanId)
    .eq("angle", angle)
    .maybeSingle();
  if (photo) {
    await ctx.supabase.from("photos_bilan").delete().eq("id", photo.id);
    await ctx.supabase.storage.from("photos").remove([photo.fichier_path]);
  }
  rafraichir(ctx.bilan.cliente_id, bilanId);
  return {};
}

export async function supprimerBilan(bilanId: string): Promise<{ erreur?: string }> {
  const ctx = await bilanAccessible(bilanId);
  if (!ctx) return { erreur: "Bilan introuvable." };
  const { data: photos } = await ctx.supabase
    .from("photos_bilan")
    .select("fichier_path")
    .eq("bilan_id", bilanId);
  const { error } = await ctx.supabase.from("bilans").delete().eq("id", bilanId);
  if (error) return { erreur: "La suppression a échoué." };
  if (photos?.length) await ctx.supabase.storage.from("photos").remove(photos.map((p) => p.fichier_path));
  rafraichir(ctx.bilan.cliente_id);
  return {};
}

export async function marquerRetourLu(bilanId: string) {
  if (!UUID.test(bilanId)) return;
  const session = await lireSession();
  if (!session) return;
  await session.supabase.rpc("marquer_retour_lu", { p_bilan: bilanId });
}
