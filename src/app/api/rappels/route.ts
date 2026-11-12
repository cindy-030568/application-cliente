import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { executerRappels } from "@/lib/envoi-rappels";

/**
 * Tâche quotidienne des rappels de bilan, lancée par Vercel (voir vercel.json).
 * Vercel envoie « Authorization: Bearer <CRON_SECRET> » : sans ce secret, rien ne se passe.
 * La réponse ne contient que des compteurs (aucune donnée personnelle).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const recu = Buffer.from(request.headers.get("authorization") ?? "");
  const attendu = Buffer.from(`Bearer ${secret}`);
  if (!secret || recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) {
    return Response.json({ erreur: "non autorisé" }, { status: 401 });
  }
  try {
    const bilan = await executerRappels(createAdminClient());
    return Response.json(bilan);
  } catch (e) {
    console.error("Rappels : échec de la tâche", e instanceof Error ? e.message : "erreur inconnue");
    return Response.json({ erreur: "échec" }, { status: 500 });
  }
}
