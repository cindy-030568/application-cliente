"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconeAccueil,
  IconeCommunaute,
  IconeNutrition,
  IconeRecettes,
  IconeSport,
  IconeSuivi,
} from "@/components/icones";
import { cx } from "@/components/ui";

const ONGLETS = [
  { href: "/", label: "Accueil", Icone: IconeAccueil },
  { href: "/nutrition", label: "Nutrition", Icone: IconeNutrition },
  { href: "/recettes", label: "Recettes", Icone: IconeRecettes },
  { href: "/sport", label: "Sport", Icone: IconeSport },
  { href: "/suivi", label: "Suivi", Icone: IconeSuivi },
];
const COMMUNAUTE = { href: "/communaute", label: "Communauté", Icone: IconeCommunaute };
/** Sur les petits écrans (iPhone SE), « Communauté » ne tient pas sous l'icône. */
const libelle = (label: string) =>
  label === COMMUNAUTE.label ? (
    <>
      <span className="min-[360px]:hidden">Groupe</span>
      <span className="hidden min-[360px]:inline">{label}</span>
    </>
  ) : (
    label
  );

/** Barre du bas. L'onglet Communauté n'apparaît que si elle est ouverte (et la cliente pas retirée). */
export function BarreOnglets({ communaute }: { communaute?: { nonLus: number } | null }) {
  const chemin = usePathname();
  const onglets = communaute ? [...ONGLETS, COMMUNAUTE] : ONGLETS;
  return (
    <nav
      aria-label="Navigation principale"
      className="pb-encoche fixed inset-x-0 bottom-0 z-30 border-t border-ligne bg-blanc-casse/90 backdrop-blur-md"
    >
      <ul className={cx("mx-auto grid max-w-lg pt-2", communaute ? "grid-cols-6 px-1" : "grid-cols-5 px-2")}>
        {onglets.map(({ href, label, Icone }) => {
          const actif = href === "/" ? chemin === "/" : chemin.startsWith(href);
          const pastille = href === COMMUNAUTE.href && !actif ? (communaute?.nonLus ?? 0) : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                aria-label={pastille ? `${label}, ${pastille} nouveau${pastille > 1 ? "x" : ""} message${pastille > 1 ? "s" : ""}` : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl transition-colors",
                  communaute ? "text-[10.5px] tracking-tight" : "text-[11.5px]",
                  actif ? "font-medium text-chocolat" : "text-texte-2 hover:text-chocolat",
                )}
              >
                <span
                  className={cx(
                    "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    actif && "bg-accent-pale",
                  )}
                >
                  <Icone className="size-[22px]" strokeWidth={actif ? 2 : 1.7} />
                  {pastille > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-1 right-0.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10.5px] font-semibold leading-[18px] text-white tabular-nums"
                    >
                      {pastille > 9 ? "9+" : pastille}
                    </span>
                  )}
                </span>
                {libelle(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
