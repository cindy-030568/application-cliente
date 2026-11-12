import { NextResponse } from "next/server";
import { lireSession } from "@/lib/auth";
import { libelleChamp } from "@/lib/champs";
import { chargerBilans, chargerChamps } from "@/lib/suivi";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cellule(v: string | null | undefined): string {
  const s = (v ?? "").replace(/\r?\n/g, " ");
  return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export CSV (séparateur « ; », virgule décimale) : s'ouvre directement dans Excel en français. */
export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await lireSession();
  if (!session || session.profil.role !== "coach") return new NextResponse("Accès refusé", { status: 403 });
  if (!UUID.test(id)) return new NextResponse("Introuvable", { status: 404 });

  const { data: c } = await session.supabase
    .from("clientes")
    .select("frequence_bilan_jours, profils!inner(prenom, nom)")
    .eq("id", id)
    .maybeSingle<{ frequence_bilan_jours: number; profils: { prenom: string; nom: string } }>();
  if (!c) return new NextResponse("Introuvable", { status: 404 });

  const [champs, bilans] = await Promise.all([chargerChamps(session.supabase, true), chargerBilans(session.supabase, id)]);
  const utilises = champs.filter((ch) => bilans.some((b) => b.valeurs.some((v) => v.champ_id === ch.id)));
  const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false });

  const entete = [
    "Date",
    "Type",
    ...utilises.map((ch) => {
      const l = libelleChamp(ch, c.frequence_bilan_jours);
      return ch.unite ? `${l} (${ch.unite})` : ch.type === "echelle" ? `${l} (/10)` : l;
    }),
    "Photos",
    "Commentaire",
    "Retour de Cindy",
  ];
  const lignes = [...bilans]
    .sort((a, b) => a.date_mesure.localeCompare(b.date_mesure))
    .map((b) => [
      b.date_mesure.split("-").reverse().join("/"),
      b.echeance ? "Bilan" : "Saisie libre",
      ...utilises.map((ch) => {
        const v = b.valeurs.find((x) => x.champ_id === ch.id);
        if (!v) return "";
        const principal = v.valeur_texte ?? (v.valeur_num !== null ? nf.format(v.valeur_num) : "");
        return v.precision ? `${principal}${principal ? " — " : ""}${v.precision}` : principal;
      }),
      String(b.photos.length),
      b.commentaire ?? "",
      b.retour?.contenu ?? "",
    ]);

  const csv = "﻿" + [entete, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n");
  const nom = `${c.profils.prenom}-${c.profils.nom}`.normalize("NFD").replace(/[^\w-]+/g, "").toLowerCase() || "cliente";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="suivi-${nom}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
