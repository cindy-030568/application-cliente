"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconeAccueil,
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

export function BarreOnglets() {
  const chemin = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="pb-encoche fixed inset-x-0 bottom-0 z-30 border-t border-ligne bg-blanc-casse/90 backdrop-blur-md"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-2 pt-2">
        {ONGLETS.map(({ href, label, Icone }) => {
          const actif = href === "/" ? chemin === "/" : chemin.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11.5px] transition-colors",
                  actif ? "font-medium text-chocolat" : "text-texte-2 hover:text-chocolat",
                )}
              >
                <span
                  className={cx(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    actif && "bg-accent-pale",
                  )}
                >
                  <Icone className="size-[22px]" strokeWidth={actif ? 2 : 1.7} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
