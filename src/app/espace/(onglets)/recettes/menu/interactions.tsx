"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { IconePlus } from "@/components/icones";
import { Bouton, Message } from "@/components/ui";
import { ajouterMenuAuxCourses } from "@/app/espace/actions";

/** « Ajouter le menu à ma liste de courses », pour 1 à 6 personnes. */
export function AjoutCourses({ lundi }: { lundi: string }) {
  const [personnes, setPersonnes] = useState(1);
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-[14.5px]">Pour</span>
        <button type="button" aria-label="Une personne de moins" disabled={personnes <= 1} onClick={() => setPersonnes((n) => n - 1)} className="flex size-10 items-center justify-center rounded-full bg-sable disabled:opacity-40">
          <span aria-hidden className="text-lg leading-none">−</span>
        </button>
        <span className="min-w-20 text-center font-medium" aria-live="polite">
          {personnes} personne{personnes > 1 ? "s" : ""}
        </span>
        <button type="button" aria-label="Une personne de plus" disabled={personnes >= 6} onClick={() => setPersonnes((n) => n + 1)} className="flex size-10 items-center justify-center rounded-full bg-sable disabled:opacity-40">
          <IconePlus className="size-4" />
        </button>
      </div>
      <Bouton type="button" disabled={enCours} onClick={() => demarrer(async () => setEtat(await ajouterMenuAuxCourses(lundi, personnes)))}>
        {enCours ? "Ajout…" : "Ajouter le menu à ma liste de courses"}
      </Bouton>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && (
        <Message ton="succes">
          {etat.succes}{" "}
          <Link href="/espace/recettes/courses" className="font-medium underline underline-offset-4">
            Voir ma liste
          </Link>
        </Message>
      )}
      {!etat.succes && (
        <Link href="/espace/recettes/courses" className="self-start text-[14px] text-texte-2 underline underline-offset-4">
          Ma liste de courses
        </Link>
      )}
    </div>
  );
}

/** Les étapes du batch cooking, à cocher au fur et à mesure (gardées sur ce téléphone). */
export function EtapesBatch({ lundi, etapes }: { lundi: string; etapes: string[] }) {
  const cle = `batch-${lundi}`;
  const [faites, setFaites] = useState<number[]>([]);
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(cle);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du stockage local au montage
      if (brut) setFaites(JSON.parse(brut));
    } catch {}
  }, [cle]);
  const basculer = (i: number) => {
    const n = faites.includes(i) ? faites.filter((x) => x !== i) : [...faites, i];
    setFaites(n);
    try {
      window.localStorage.setItem(cle, JSON.stringify(n));
    } catch {}
  };
  return (
    <ol className="flex flex-col gap-2">
      {etapes.map((e, i) => (
        <li key={i}>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-creme/10 p-3">
            <input type="checkbox" checked={faites.includes(i)} onChange={() => basculer(i)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
            <span className={faites.includes(i) ? "text-[15px] text-texte-clair line-through" : "text-[15px]"}>{e}</span>
          </label>
        </li>
      ))}
    </ol>
  );
}
