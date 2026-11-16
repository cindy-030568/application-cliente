import { NextResponse } from "next/server";
import { lireSession } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { numeroSemaine } from "@/lib/journal";
import { lireJournal } from "@/lib/journal-serveur";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cellule = (v: string) => {
  const s = v.replace(/\r?\n/g, " ");
  return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Journal quotidien en CSV (séparateur « ; », virgule décimale) : s'ouvre dans Excel en français. */
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") return new NextResponse("Accès refusé", { status: 403 });
  if (!UUID.test(id)) return new NextResponse("Introuvable", { status: 404 });
  const { data: c } = await session.supabase
    .from("clientes")
    .select("date_debut, profils!inner(prenom, nom)")
    .eq("id", id)
    .maybeSingle<{ date_debut: string | null; profils: { prenom: string; nom: string } }>();
  const entrees = await lireJournal(session.supabase, id);
  if (!c || !entrees) return new NextResponse("Introuvable", { status: 404 });
  const debut = c.date_debut ?? entrees.at(-1)?.jour ?? aujourdhuiParis();
  const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false });
  const n = (x: number | null) => (x === null ? "" : nf.format(x));
  const entete = ["Semaine", "Date", "Poids (kg)", "Tour de taille (cm)", "Sommeil (h)", "Hydratation (L)", "Pas", "Trainings", "Stress (1-5)", "Digestion (1-5)", "Règles", "Observations"];
  const lignes = [...entrees]
    .sort((a, b) => a.jour.localeCompare(b.jour))
    .map((e) => [
      String(numeroSemaine(debut, e.jour)),
      e.jour.split("-").reverse().join("/"),
      n(e.poids), n(e.tour_taille), n(e.sommeil), n(e.hydratation), n(e.pas), n(e.trainings), n(e.stress), n(e.digestion),
      e.regles ? "X" : "",
      e.observations ?? "",
    ]);
  const csv = "﻿" + [entete, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n");
  const nom = `${c.profils.prenom}-${c.profils.nom}`.normalize("NFD").replace(/[^\w-]+/g, "").toLowerCase() || "cliente";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="journal-${nom}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
