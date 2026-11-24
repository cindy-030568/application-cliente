"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { bilanFinVisible, lireOffres } from "@/lib/bilan-fin";
import { notifierCoach } from "@/lib/notifications-coach";

export type EtatSuite = { erreur?: string; succes?: string };

/** « Ça m'intéresse » sur une offre du bloc « continuer avec moi » : enregistré, et la coach est prévenue. */
export async function demanderSuite(offre: string): Promise<EtatSuite> {
  const session = await lireSession();
  if (!session || session.profil.role !== "cliente") return { erreur: "Ta session a expiré. Reconnecte-toi, puis réessaie." };
  const { supabase, profil } = session;
  const [{ data: fiche }, { data: reglages }] = await Promise.all([
    supabase.from("clientes").select("statut, date_fin").eq("id", profil.id).maybeSingle<{ statut: string; date_fin: string | null }>(),
    supabase.from("reglages").select("fin_offres").maybeSingle<{ fin_offres: unknown }>(),
  ]);
  if (!fiche || !bilanFinVisible(fiche, aujourdhuiParis())) return { erreur: "Ce n’est pas encore le moment." };
  const choisie = lireOffres(reglages?.fin_offres).find((o) => o.titre === offre);
  if (!choisie) return { erreur: "Cette offre n’est plus proposée." };
  const { error } = await supabase.from("demandes_suite").insert({ cliente_id: profil.id, offre: choisie.titre });
  if (error) return { erreur: "Ça n’a pas fonctionné. Réessaie." };
  after(() => notifierCoach({ type: "suite", clienteId: profil.id, offre: choisie.titre }));
  revalidatePath("/bilan-de-fin");
  return { succes: "C’est noté ! Cindy revient vers toi très vite 💛" };
}
