"use server";

import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { lienAudio } from "@/lib/ressources-serveur";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function session() {
  const s = await lireSession();
  return s && s.profil.role !== "coach" ? s : null;
}

/** Cœur : ajoute ou retire une ressource de ses favoris. */
export async function basculerFavoriRessource(id: string, favori: boolean): Promise<boolean> {
  const s = await session();
  if (!s || !UUID.test(id)) return false;
  const { error } = favori
    ? await s.supabase.from("ressources_favoris").upsert({ cliente_id: s.profil.id, ressource_id: id }, { onConflict: "cliente_id,ressource_id", ignoreDuplicates: true })
    : await s.supabase.from("ressources_favoris").delete().eq("cliente_id", s.profil.id).eq("ressource_id", id);
  revalidatePath("/ressources");
  revalidatePath("/espace/ressources");
  return !error;
}

/** Garde la position d'écoute sur son compte (pour reprendre où elle s'est arrêtée, sur n'importe quel appareil). */
export async function enregistrerEcoute(id: string, position: number, terminee: boolean): Promise<void> {
  const s = await session();
  if (!s || !UUID.test(id) || !Number.isFinite(position)) return;
  await s.supabase.from("ressources_ecoutes").upsert(
    { cliente_id: s.profil.id, ressource_id: id, position_s: Math.max(0, Math.min(36000, Math.round(position))), terminee: terminee === true, maj_le: new Date().toISOString() },
    { onConflict: "cliente_id,ressource_id" },
  );
}

/** Nouveau lien temporaire si l'ancien a expiré (écoute très longue, page restée ouverte). */
export async function nouveauLienAudio(id: string): Promise<string | null> {
  const s = await lireSession();
  if (!s || !UUID.test(id)) return null;
  const { data } = await s.supabase.from("ressources").select("audio_path").eq("id", id).maybeSingle<{ audio_path: string | null }>();
  return data?.audio_path ? lienAudio(s.supabase, data.audio_path) : null;
}
