"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const CLE = "fitw_victoires_vues";
const lire = () => {
  try {
    return localStorage.getItem(CLE) ?? "[]";
  } catch {
    return "[]";
  }
};
const rien = () => () => {};
function vues(brut: string): string[] {
  try {
    const v = JSON.parse(brut);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export type VictoireAffichee = { cle: string; emoji: string; titre: string };

/**
 * Carte « Victoire hors balance » de l'accueil : les victoires des 7 derniers jours pas encore vues.
 * « Merci » la range (gardé sur le téléphone). Côté serveur, rien ne s'affiche.
 */
export function CarteVictoires({ victoires }: { victoires: VictoireAffichee[] }) {
  const brut = useSyncExternalStore(rien, lire, () => null);
  const [fermees, setFermees] = useState<string[]>([]);
  if (brut === null) return null;
  const dejaVues = new Set([...vues(brut), ...fermees]);
  const aMontrer = victoires.filter((v) => !dejaVues.has(v.cle));
  if (!aMontrer.length) return null;

  function merci() {
    const cles = aMontrer.map((v) => v.cle);
    setFermees((f) => [...f, ...cles]);
    try {
      // On ne garde que les 60 dernières, pour ne pas encombrer le téléphone.
      localStorage.setItem(CLE, JSON.stringify([...vues(lire()), ...cles].slice(-60)));
    } catch {}
  }

  return (
    <section aria-labelledby="titre-victoires" className="relative overflow-hidden rounded-carte bg-accent-pale p-5 apparition">
      <span aria-hidden className="absolute -right-6 -top-6 text-[88px] leading-none opacity-15">
        🏆
      </span>
      <div className="relative flex flex-col gap-3">
        <span id="titre-victoires" className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">
          {aMontrer.length > 1 ? "Tes victoires hors balance" : "Ta victoire hors balance"}
        </span>
        <ul className="flex flex-col gap-2">
          {aMontrer.map((v) => (
            <li key={v.cle} className="flex items-start gap-3">
              <span aria-hidden className="text-[22px] leading-7">
                {v.emoji}
              </span>
              <span className="font-titre text-[18px] font-bold leading-snug">{v.titre}</span>
            </li>
          ))}
        </ul>
        <p className="text-[14px] text-texte-2">Ce sont ces progrès-là qui durent. Sois fière de toi 💛</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={merci}
            className="inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-chocolat px-5 text-[15px] font-medium text-creme"
          >
            Merci 💛
          </button>
          <Link href="/avis?de=victoire" className="text-[14.5px] font-medium underline underline-offset-4">
            Laisser un témoignage
          </Link>
        </div>
      </div>
    </section>
  );
}
