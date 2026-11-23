"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { lireHeures, lireNombre } from "@/lib/journal";
import { detecterAlerte } from "@/lib/alertes-notes";
import { notifierCoach } from "@/lib/notifications-coach";

export type EtatJournal = { erreur?: string; succes?: string };

const BORNES = {
  poids: [20, 400],
  tour_taille: [20, 300],
  sommeil: [0, 24],
  hydratation: [0, 15],
  pas: [0, 150000],
} as const;

/** Enregistre (ou corrige) la journée de la cliente connectée. */
export async function enregistrerJournee(_e: EtatJournal, formData: FormData): Promise<EtatJournal> {
  const session = await lireSession();
  if (!session || session.profil.role !== "cliente") return { erreur: "Ta session a expiré. Reconnecte-toi, puis réessaie." };
  const jour = String(formData.get("jour") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || jour > aujourdhuiParis() || jour < "2020-01-01") return { erreur: "La date n’est pas valide." };

  const ligne: Record<string, number | string | boolean | null> = { cliente_id: session.profil.id, jour };
  const texte = (k: string) => String(formData.get(k) ?? "");
  for (const [cle, [min, max]] of Object.entries(BORNES)) {
    if (!formData.has(cle)) continue;
    const v = cle === "sommeil" ? lireHeures(texte(cle)) : lireNombre(texte(cle));
    if (v !== null && (Number.isNaN(v) || v < min || v > max)) {
      const noms: Record<string, string> = { poids: "Le poids", tour_taille: "Le tour de taille", sommeil: "Le sommeil", hydratation: "L’hydratation", pas: "Le nombre de pas" };
      return { erreur: `${noms[cle]} n’est pas valide.` };
    }
    ligne[cle] = v === null ? null : cle === "pas" ? Math.round(v) : Math.round(v * 100) / 100;
  }
  for (const cle of ["trainings", "stress", "digestion"]) {
    const v = texte(cle);
    const n = v === "" ? null : Number(v);
    const [min, max] = cle === "trainings" ? [0, 5] : [1, 5];
    if (n !== null && (!Number.isInteger(n) || n < min || n > max)) return { erreur: "Une des notes n’est pas valide." };
    ligne[cle] = n;
  }
  ligne.regles = formData.get("regles") === "on";
  ligne.observations = texte("observations").trim().slice(0, 1000) || null;

  // Ce qui existait déjà ce jour-là : la coach n'est prévenue qu'une fois par journée, et d'une note à lire vite que si elle est nouvelle.
  const { data: avant } = await session.supabase
    .from("journal_quotidien")
    .select("observations")
    .eq("cliente_id", session.profil.id)
    .eq("jour", jour)
    .maybeSingle<{ observations: string | null }>();
  const { error } = await session.supabase.from("journal_quotidien").upsert(ligne, { onConflict: "cliente_id,jour" });
  if (error) return { erreur: "Ta journée n’a pas pu être enregistrée. Réessaie dans un instant." };
  const clienteId = session.profil.id;
  const note = ligne.observations as string | null;
  const motif = note && note !== avant?.observations ? detecterAlerte(note) : null;
  const nouvelle = !avant;
  if (motif || nouvelle) {
    after(async () => {
      if (motif) await notifierCoach({ type: "alerte", clienteId, motif, source: "journal" });
      if (nouvelle) await notifierCoach({ type: "journal", clienteId });
    });
  }
  revalidatePath("/suivi/journal");
  revalidatePath("/");
  return { succes: "Journée enregistrée ✓" };
}

/** Heure du rappel quotidien du journal (« 20:30 »), ou null pour le couper. */
export async function definirRappelJournal(heure: string | null): Promise<EtatJournal> {
  const session = await lireSession();
  if (!session || session.profil.role !== "cliente") return { erreur: "Ta session a expiré. Reconnecte-toi, puis réessaie." };
  if (heure !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(heure))) return { erreur: "L’heure n’est pas valide." };
  const { error } = await session.supabase.rpc("definir_rappel_journal", { p_heure: heure });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  revalidatePath("/suivi/journal");
  return { succes: heure ? `C’est noté : rappel chaque jour à ${heure.replace(":", " h ")}.` : "Rappel quotidien coupé." };
}
