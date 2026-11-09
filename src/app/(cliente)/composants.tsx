import Link from "next/link";
import type { ReactNode } from "react";
import { IconeProfil } from "@/components/icones";
import { Logo } from "@/components/ui";

export function EnTete({ titre, sousTitre }: { titre: ReactNode; sousTitre?: ReactNode }) {
  return (
    <header className="pt-encoche flex flex-col gap-5 px-5 pb-2">
      <div className="flex items-center justify-between">
        <Logo className="text-lg" />
        <Link
          href="/profil"
          aria-label="Mon profil"
          className="flex size-10 items-center justify-center rounded-full bg-blanc-casse text-chocolat shadow-douce"
        >
          <IconeProfil className="size-5" />
        </Link>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="font-titre text-[30px] font-bold leading-[1.12]">{titre}</h1>
        {sousTitre && <p className="text-[15px] text-texte-2">{sousTitre}</p>}
      </div>
    </header>
  );
}

export function BientotDisponible({
  icone,
  titre,
  texte,
}: {
  icone: ReactNode;
  titre: string;
  texte: string;
}) {
  return (
    <div className="mx-5 mt-4 flex flex-col items-center gap-3 rounded-bloc border border-dashed border-caramel-clair bg-blanc-casse/60 px-6 py-12 text-center apparition">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent-pale text-chocolat">
        {icone}
      </span>
      <p className="font-titre text-xl font-bold">{titre}</p>
      <p className="max-w-xs text-[15px] text-texte-2">{texte}</p>
    </div>
  );
}
