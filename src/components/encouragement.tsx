"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const CLE = "fitw_encouragement_vu";
const lire = () => {
  try {
    return localStorage.getItem(CLE) ?? "";
  } catch {
    return "";
  }
};
const rien = () => () => {};

/**
 * Le petit mot du jour, à la première ouverture de l'appli dans la journée.
 * Côté serveur, rien ne s'affiche (on ne sait pas encore s'il a déjà été vu).
 */
export function EncouragementDuJour({ jour, phrase }: { jour: string; phrase: string }) {
  const dejaVu = useSyncExternalStore(rien, lire, () => jour);
  const [ferme, setFerme] = useState(false);
  const ouvert = dejaVu !== jour && !ferme;

  useEffect(() => {
    if (!ouvert) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  });

  function fermer() {
    setFerme(true);
    try {
      localStorage.setItem(CLE, jour);
    } catch {}
  }

  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-chocolat/45 p-4 backdrop-blur-[2px] sm:items-center" onClick={fermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mot-du-jour"
        tabIndex={-1}
        autoFocus
        onClick={(e) => e.stopPropagation()}
        className="mb-[env(safe-area-inset-bottom)] flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] bg-creme px-6 pb-6 pt-7 text-center shadow-douce outline-none apparition"
      >
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-accent-pale text-[26px]">
          🌸
        </span>
        <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">Ton petit mot du jour</span>
        <p id="mot-du-jour" className="font-main text-[30px] leading-[1.15] text-chocolat">
          {phrase}
        </p>
        <span className="text-[14px] text-texte-2">Cindy 💛</span>
        <button
          type="button"
          onClick={fermer}
          className="mt-1 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-[16px] font-medium text-white"
        >
          Merci, belle journée ✨
        </button>
      </div>
    </div>
  );
}
