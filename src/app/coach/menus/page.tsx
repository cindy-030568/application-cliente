import type { Metadata } from "next";
import Link from "next/link";
import { Etiquette, Message, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { ajouterJours, aujourdhuiParis } from "@/lib/bilan";
import { periodeSemaine } from "@/lib/menus";
import { lundiDe } from "@/lib/recap-semaine";

export const metadata: Metadata = { title: "Menus de la semaine" };

type Ligne = { lundi: string; publie: boolean; menus_repas: { count: number }[] | null };

/** Les menus de la semaine des abonnées : les 2 semaines passées, celle en cours et les 4 suivantes. */
export default async function PageMenus() {
  const { supabase } = await exigerCoach();
  const cette = lundiDe(aujourdhuiParis());
  const semaines = Array.from({ length: 7 }, (_, i) => ajouterJours(cette, (i - 2) * 7));
  const { data, error } = await supabase
    .from("menus_semaine")
    .select("lundi, publie, menus_repas(count)")
    .gte("lundi", semaines[0])
    .lte("lundi", semaines.at(-1)!)
    .returns<Ligne[]>();
  const parLundi = new Map((data ?? []).map((m) => [m.lundi, m]));
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Surtitre>Espace abonnées</Surtitre>
        <h1 className="font-titre text-[34px] font-bold leading-tight">Menus de la semaine</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-texte-2">
          Chaque semaine, l’appli te propose un menu complet avec tes recettes publiées. Tu le retouches, tu écris ton mot et les étapes du
          batch cooking du dimanche, puis tu le publies : tes abonnées le reçoivent avec sa liste de courses.
        </p>
      </div>
      {error ? (
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0047_menus_semaine.sql (voir le guide).</Message>
      ) : (
        <ul className="flex flex-col gap-2">
          {semaines.map((lundi) => {
            const m = parLundi.get(lundi);
            const nb = m?.menus_repas?.[0]?.count ?? 0;
            return (
              <li key={lundi}>
                <Link
                  href={`/coach/menus/${lundi}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-carte bg-blanc-casse px-5 py-4 shadow-douce hover:bg-white"
                >
                  <span className="flex flex-col">
                    <span className="font-medium first-letter:uppercase">
                      Semaine {periodeSemaine(lundi)}
                      {lundi === cette && <span className="ml-2 text-[13px] font-normal text-caramel-texte">· en cours</span>}
                    </span>
                    <span className="text-[13.5px] text-texte-2">{nb ? `${nb} repas sur 28` : "Pas encore préparé"}</span>
                  </span>
                  {m?.publie ? <Etiquette ton="vert">Publié</Etiquette> : m ? <Etiquette ton="rose">Brouillon</Etiquette> : <Etiquette ton="sable">À préparer</Etiquette>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
