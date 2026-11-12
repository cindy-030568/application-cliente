"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconeClientes,
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
  { href: "/coach/recettes", label: "Recettes", Icone: IconeRecettes },
  { href: "/coach/aliments", label: "Aliments", Icone: IconeNutrition },
  { href: "/coach/videos", label: "Vidéos", Icone: IconeVideo },
  { href: "/coach/ressources", label: "Ressources", Icone: IconeRessources },
  { href: "/coach/reglages", label: "Réglages", Icone: IconeReglages },
];

const A_VENIR: string[] = [];

export function NavigationCoach({ aTraiter = 0 }: { aTraiter?: number }) {
  const chemin = usePathname();
  return (
    <nav aria-label="Navigation coach" className="-mx-1 flex w-full gap-1 overflow-x-auto px-1 md:mx-0 md:w-auto md:flex-col md:overflow-visible md:px-0">
      {LIENS.map(({ href, label, Icone }) => {
        const actif = href === "/coach" ? chemin === "/coach" : chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? "page" : undefined}
            title={label}
            className={cx(
              "flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors",
              actif ? "bg-chocolat text-creme" : "text-chocolat hover:bg-sable/60",
            )}
          >
            <Icone className="size-5 shrink-0" />
            <span className="sr-only md:not-sr-only">{label}</span>
            {href === "/coach/bilans" && aTraiter > 0 && (
              <span
                aria-label={`${aTraiter} à traiter`}
                className="rounded-full bg-accent px-2 py-0.5 md:ml-auto text-[11.5px] font-medium text-white"
              >
                {aTraiter}
              </span>
            )}
          </Link>
        );
      })}
      {A_VENIR.length > 0 && <div className="mt-6 hidden flex-col gap-1 md:flex">
        <p className="px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-texte-2">
          Bientôt
        </p>
        {A_VENIR.map((l) => (
          <span key={l} className="px-3 py-2 text-[14px] text-texte-2/70">
            {l}
          </span>
        ))}
      </div>}
    </nav>
  );
}
