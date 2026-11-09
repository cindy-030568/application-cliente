"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconeClientes, IconeReglages, IconeRessources, IconeTableau } from "@/components/icones";
import { cx } from "@/components/ui";

const LIENS = [
  { href: "/coach", label: "Tableau de bord", Icone: IconeTableau },
  { href: "/coach/clientes", label: "Clientes", Icone: IconeClientes },
  { href: "/coach/ressources", label: "Ressources", Icone: IconeRessources },
  { href: "/coach/reglages", label: "Réglages", Icone: IconeReglages },
];

const A_VENIR = ["Recettes", "Aliments", "Vidéos"];

export function NavigationCoach() {
  const chemin = usePathname();
  return (
    <nav aria-label="Navigation coach" className="flex gap-1 md:flex-col">
      {LIENS.map(({ href, label, Icone }) => {
        const actif = href === "/coach" ? chemin === "/coach" : chemin.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors",
              actif ? "bg-chocolat text-creme" : "text-chocolat hover:bg-sable/60",
            )}
          >
            <Icone className="size-5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
      <div className="mt-6 hidden flex-col gap-1 md:flex">
        <p className="px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-texte-2">
          Bientôt
        </p>
        {A_VENIR.map((l) => (
          <span key={l} className="px-3 py-2 text-[14px] text-texte-2/70">
            {l}
          </span>
        ))}
      </div>
    </nav>
  );
}
