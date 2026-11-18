import { NextResponse } from "next/server";
import { lireSession } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { csvEncaissements } from "@/lib/revenus";
import { lireMouvements } from "@/lib/revenus-serveur";

/** Encaissements de l'année en CSV pour la comptabilité (s'ouvre dans Excel). */
export async function GET(requete: Request) {
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") return new NextResponse("Accès refusé", { status: 403 });
  const brut = new URL(requete.url).searchParams.get("annee") ?? "";
  const an = /^\d{4}$/.test(brut) ? Number(brut) : Number(aujourdhuiParis().slice(0, 4));
  const donnees = await lireMouvements(session.supabase);
  if (!donnees) return new NextResponse("Mise à jour de la base nécessaire", { status: 404 });
  return new NextResponse(csvEncaissements(donnees.mouvements, an), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="revenus-${an}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
