"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  IconeClientes,
  IconeCommunaute,
  IconeNutrition,
  IconeRecettes,
  IconeReglages,
  IconeRessources,
  IconeSuivi,
  IconeTableau,
  IconeVideo,
} from "@/components/icones";
import { cx } from "@/components/ui";

const LIENS = [
  { href: "/coach", label: "Tableau de bord", Icone: IconeTableau },
  { href: "/coach/bilans", label: "Bilans", Icone: IconeSuivi },
  { href: "/coach/clientes", label: "Clientes", Icone: IconeClientes },
  { href: "/coach/communaute", label: "Communauté", Icone: IconeCommunaute },
  { href: "/coach/recettes", label: "Recettes", Icone: IconeRecettes },
  { href: "/coach/aliments", label: "Aliments", Icone: IconeNutrition },
  { href: "/coach/videos", label: "Vidéos", Icone: IconeVideo },
  { href: "/coach/ressources", label: "Ressources", Icone: IconeRessources },
  { href: "/coach/reglages", label: "Réglages", Icone: IconeReglages },
];

function Pastille({ n, texte, className }: { n: number; texte: string; className?: string }) {
  if (n <= 0) return null;
  return (
    <span aria-label={texte} className={cx("shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11.5px] font-medium text-white", className)}>
      {n}
    </span>
  );
}

/**
 * Menu coach. Ordinateur : colonne de gauche. Téléphone : un bouton « Menu » qui affiche la page en cours
 * et déplie la liste complète (noms écrits, pastilles).
 */
export function NavigationCoach({ aTraiter = 0, signalements = 0 }: { aTraiter?: number; signalements?: number }) {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const estActif = (href: string) => (href === "/coach" ? chemin === "/coach" : chemin.startsWith(href));
  const courant = LIENS.find((l) => estActif(l.href)) ?? LIENS[0];
  const pastilles = (href: string) =>
    href === "/coach/bilans"
      ? { n: aTraiter, texte: `${aTraiter} à traiter` }
      : href === "/coach/communaute"
        ? { n: signalements, texte: `${signalements} signalement${signalements > 1 ? "s" : ""}` }
        : { n: 0, texte: "" };
  const total = aTraiter + signalements;

  const lien = (l: (typeof LIENS)[number], mobile: boolean) => {
    const actif = estActif(l.href);
    const p = pastilles(l.href);
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={actif ? "page" : undefined}
        onClick={() => setOuvert(false)}
        className={cx(
          "flex min-h-11 items-center rounded-xl py-2.5 transition-colors",
          mobile ? "gap-2 px-2.5 text-[14px]" : "gap-3 px-3 text-[14.5px]",
          actif ? "bg-chocolat text-creme" : mobile ? "bg-sable/50 text-chocolat" : "text-chocolat hover:bg-sable/60",
        )}
      >
        <l.Icone className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{l.label}</span>
        <Pastille n={p.n} texte={p.texte} />
      </Link>
    );
  };

  return (
    <>
      {/* Téléphone */}
      <div className="w-full md:hidden">
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls="menu-coach"
          onClick={() => setOuvert(!ouvert)}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border-[1.5px] border-chocolat bg-white px-4 text-left"
        >
          <span aria-hidden className="flex flex-col gap-[4px]">
            <span className={cx("block h-[2px] w-5 rounded bg-chocolat transition-transform", ouvert && "translate-y-[6px] rotate-45")} />
            <span className={cx("block h-[2px] w-5 rounded bg-chocolat transition-opacity", ouvert && "opacity-0")} />
            <span className={cx("block h-[2px] w-5 rounded bg-chocolat transition-transform", ouvert && "-translate-y-[6px] -rotate-45")} />
          </span>
          <span className="font-medium">Menu</span>
          <span className="min-w-0 flex-1 truncate text-[14px] text-texte-2">· {courant.label}</span>
          {!ouvert && <Pastille n={total} texte={`${total} à regarder`} />}
        </button>
        {ouvert && (
          <nav id="menu-coach" aria-label="Navigation coach" className="mt-2 grid grid-cols-2 gap-2 pb-1">
            {LIENS.map((l) => lien(l, true))}
          </nav>
        )}
      </div>

      {/* Ordinateur */}
      <nav aria-label="Navigation coach" className="hidden flex-col gap-1 md:flex">
        {LIENS.map((l) => lien(l, false))}
      </nav>
    </>
  );
}
