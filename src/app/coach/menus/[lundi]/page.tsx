import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Etiquette, Message, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { periodeSemaine, type CaseMenu } from "@/lib/menus";
import { EditeurMenu } from "./editeur";

export const metadata: Metadata = { title: "Menu de la semaine" };

type Menu = { id: string; mot: string | null; batch: string | null; publie: boolean };

export default async function PageMenu({ params }: { params: Promise<{ lundi: string }> }) {
  const { lundi } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lundi) || new Date(`${lundi}T12:00:00Z`).getUTCDay() !== 1) notFound();
  const { supabase } = await exigerCoach();
  const [{ data: menu, error }, { data: recettes }] = await Promise.all([
    supabase.from("menus_semaine").select("id, mot, batch, publie").eq("lundi", lundi).maybeSingle<Menu>(),
    supabase
      .from("recettes")
      .select("id, titre, recettes_repas(type_repas)")
      .eq("publiee", true)
      .order("titre")
      .returns<{ id: string; titre: string; recettes_repas: { type_repas: string }[] | null }[]>(),
  ]);
  const { data: cases } = menu
    ? await supabase.from("menus_repas").select("jour, repas, recette_id").eq("menu_id", menu.id).returns<CaseMenu[]>()
    : { data: [] as CaseMenu[] };
  return (
    <div className="flex flex-col gap-6">
      <Link href="/coach/menus" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Tous les menus
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Surtitre>Menu de la semaine</Surtitre>
          <h1 className="font-titre text-[32px] font-bold leading-tight first-letter:uppercase">Semaine {periodeSemaine(lundi)}</h1>
        </div>
        {menu?.publie ? <Etiquette ton="vert">Publié</Etiquette> : <Etiquette ton="rose">Brouillon : invisible pour tes abonnées</Etiquette>}
      </div>
      {error ? (
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0047_menus_semaine.sql (voir le guide).</Message>
      ) : (
        <EditeurMenu
          lundi={lundi}
          publie={Boolean(menu?.publie)}
          mot={menu?.mot ?? ""}
          batch={menu?.batch ?? ""}
          cases={cases ?? []}
          recettes={(recettes ?? []).map((r) => ({ id: r.id, titre: r.titre, repas: (r.recettes_repas ?? []).map((x) => x.type_repas) }))}
        />
      )}
    </div>
  );
}
