import { revalidatePath } from "next/cache";
import { lireSession } from "@/lib/auth";
import { enregistrerCharges, enregistrerSeance, enregistrerSeanceExpress, notifierSeanceFaite, type ChargeNotee, type InfosSeance } from "@/lib/seances-enregistrement";

/**
 * Séances et poids gardés sur le téléphone sans réseau, envoyés au retour du réseau.
 * Chaque élément porte un identifiant créé sur le téléphone : renvoyé deux fois, il n'est enregistré qu'une fois.
 * Réponse : les éléments enregistrés (à retirer du téléphone) et ceux refusés pour de bon (à retirer aussi).
 * Les autres restent sur le téléphone et repartiront plus tard. Aucune donnée personnelle dans la réponse.
 */
type ElementSeance = { id: string; type: "seance"; programmeId: string | null; seance: number; seanceExpressId?: string; nom?: string; infos: InfosSeance; ref: string; faiteLe: string };
type ElementCharges = { id: string; type: "charges"; programmeId: string | null; ref: string; lignes: ChargeNotee[] };

export async function POST(request: Request) {
  const session = await lireSession();
  if (!session || session.profil.role !== "cliente") return Response.json({ erreur: "non connectée" }, { status: 401 });
  let corps: { elements?: unknown };
  try {
    corps = await request.json();
  } catch {
    return Response.json({ erreur: "contenu illisible" }, { status: 400 });
  }
  const elements = Array.isArray(corps.elements) ? (corps.elements.slice(0, 100) as (ElementSeance | ElementCharges)[]) : [];
  const enregistres: string[] = [];
  const refuses: string[] = [];
  let nouvelles = 0;
  for (const e of elements) {
    if (!e || typeof e.id !== "string" || e.id.length > 64) continue;
    if (e.type === "charges") {
      const r = await enregistrerCharges(session.supabase, session.profil.id, e.programmeId ? String(e.programmeId) : null, String(e.ref), e.lignes);
      if (r.ok) enregistres.push(e.id);
      else if (r.definitif) refuses.push(e.id);
    } else if (e.type === "seance") {
      const infos = e.infos ?? { dureeMinutes: null, ressenti: null, commentaire: "" };
      const commun = {
        infos: { dureeMinutes: infos.dureeMinutes ?? null, ressenti: infos.ressenti ?? null, commentaire: String(infos.commentaire ?? "") },
        ref: String(e.ref),
        faiteLe: String(e.faiteLe ?? ""),
        nomSecours: typeof e.nom === "string" ? e.nom : null,
      };
      const r = e.seanceExpressId
        ? await enregistrerSeanceExpress(session.supabase, session.profil.id, { seanceExpressId: String(e.seanceExpressId), ...commun })
        : await enregistrerSeance(session.supabase, session.profil.id, { programmeId: String(e.programmeId), seance: Number(e.seance), ...commun });
      if ("ok" in r) {
        enregistres.push(e.id);
        if (r.nouveau) {
          nouvelles++;
          notifierSeanceFaite(session.profil.id, r.nom, String(infos.commentaire ?? ""));
        }
      } else if (r.definitif) refuses.push(e.id);
    }
  }
  if (nouvelles) revalidatePath("/sport");
  return Response.json({ enregistres, refuses });
}
